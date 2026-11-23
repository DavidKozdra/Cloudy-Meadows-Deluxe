/* Runs against the real game in a disposable browser profile. */
(() => {
    'use strict';
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const home = () => levels[1][4];
    const at = (col, row) => home().map[row][col];
    function place(name, col, row) {
        return home().map[row][col] = new_tile_from_num(tile_name_to_num(name), col * tileSize, row * tileSize);
    }
    function frame(clock = false) {
        lastTimeMili = millis() - (clock ? 301 : 0);
        draw();
    }
    function snapshot() {
        const tile = (col, row) => {
            const value = at(col, row);
            const fields = ['name', 'age', 'growTimer', 'watermet', 'wateredDay', 'deathAttempts',
                'facing', 'moving_timer', 'move_bool', 'current_instruction', 'fuel', 'fuel_timer',
                'day_pause', 'day_paused', 'itemsSold', 'lastMarketUpdate', 'originalPrices'];
            const result = { pos: { x: value.pos.x, y: value.pos.y } };
            for (const field of fields) if (value[field] !== undefined) result[field] = value[field];
            if (value.inv) result.inv = value.inv.map(item => item && { name: item.name, amount: item.amount, price: item.price });
            if (value.instructions) result.instructions = value.instructions.map(item => typeof item === 'object' ? item.name : item);
            return result;
        };
        return JSON.parse(JSON.stringify({
            days, time, timephase, currentWeather, weatherLog, currentLevel_x, currentLevel_y,
            corn: tile(8, 8), strawberry: tile(10, 8), irrigated: tile(13, 8),
            harvester: tile(8, 11), harvestedBed: tile(8, 12),
            waterer: tile(11, 11), wateredBed: tile(11, 12),
            robot: tile(8, 14), compost: tile(10, 14), shop: tile(13, 14)
        }));
    }

    window.exerciseAwayFarm = async () => {
        check(!paused && !title_screen, 'Start a world before testing its simulation');
        noLoop();
        days = 22; dayOfWeek = days % 5; time = 100; timephase = 0; timeSpeed = 1;
        weatherLog = []; CloudyWeather.roll(.05);
        check(currentWeather === 'rain', 'Rain fixture did not initialize');
        // The player is at the market while all fixtures are at home.
        currentLevel_x = 5; currentLevel_y = 0;
        player.pos.set(11 * tileSize, 8 * tileSize);
        player.touching = player.tileTouching(currentLevel_x, currentLevel_y);
        player.talking = 0;
        player.inv[0] = new_item_from_num(item_name_to_num('Time Watch'), 1); player.hand = 0;
        timeSpeedIndex = 4;
        for (let row = 7; row <= 15; row++) for (let col = 7; col <= 15; col++) place('grass', col, row);
        const corn = place('corn', 8, 8);
        const strawberry = place('strawberry', 10, 8);
        const irrigated = place('strawberry', 13, 8);
        place('sprinkler', 14, 8);
        corn.growTimer = corn.growthTime - 1;
        strawberry.growTimer = strawberry.growthTime - 1;

        const harvester = place('HarvestBot', 8, 11);
        harvester.instructions = ['harvest']; harvester.move_bool = true; harvester.moving_timer = 0;
        const ripe = place('corn', 8, 12);
        ripe.age = all_imgs[ripe.png].length - 2;
        const waterer = place('WaterBot', 11, 11);
        waterer.instructions = ['water']; waterer.move_bool = true; waterer.moving_timer = 0;
        const watered = place('strawberry', 11, 12);
        const robot = place('Robot1', 7, 14);
        robot.instructions[0] = new_item_from_num(item_name_to_num('Right Command'), 1);
        robot.instructions[1] = new_item_from_num(item_name_to_num('Left Command'), 1);
        robot.inv[0] = new_item_from_num(item_name_to_num('Corn'), 3);
        robot.fuel = 50; robot.fuel_timer = 100; robot.move_bool = true; robot.moving_timer = 0;
        const compost = place('compost_tile', 10, 14); compost.age = 1;
        const shop = place('Vegetables', 13, 14);
        shop.inv[0].amount = 8; shop.itemsSold.Corn = 9; shop.lastMarketUpdate = days;

        frame();
        check(corn.age === 1 && strawberry.age === 1 && strawberry.watermet, 'Offscreen rain did not water and grow crops');
        check(at(8, 14) === robot && robot.fuel === 49 && robot.current_instruction === 1,
            'Offscreen robot did not move exactly once and consume one fuel');
        check(harvester.inv.some(item => item && item.name === 'Corn' && item.amount > 0) && at(8, 12).age === 0,
            'Offscreen harvester did not collect and replant');
        check(watered.wateredDay === days, 'Offscreen water bot did not water its crop');

        currentWeather = 'heatwave';
        const dryBefore = corn.growTimer, wetBefore = irrigated.growTimer;
        frame();
        check(corn.growTimer - dryBefore === .5 && irrigated.growTimer - wetBefore === 1,
            'Offscreen heatwave or sprinkler protection failed');
        CloudyWeather.restoreDay(days);
        const beforePause = corn.growTimer, fuelBeforePause = robot.fuel_timer;
        paused = true; frame(); paused = false;
        check(corn.growTimer === beforePause && robot.fuel_timer === fuelBeforePause, 'Paused world advanced crops or robots');
        timeSpeedIndex = 3; frame(); timeSpeedIndex = 4;
        check(corn.growTimer === beforePause && robot.fuel_timer === fuelBeforePause,
            'Rewinding world advanced crops or robots');
        timeSpeedIndex = 6; frame(); timeSpeedIndex = 4;
        check(corn.growTimer - beforePause === 5, 'Fast-forward did not advance the offscreen farm four times');

        let morningCalls = 0;
        const daily = shop.daily_update;
        shop.daily_update = function (...args) {
            morningCalls++;
            check(args[0] === dayOfWeek && args[1] === days, 'Distant shop did not receive current weather');
            return daily.apply(this, args);
        };
        // Sparse generated areas must not interrupt the morning update.
        levels[0].push(undefined);
        time = 1; timephase = 1; frame(true);
        delete shop.daily_update;
        check(morningCalls === 1, 'Distant shop restocked more than once in a morning');
        check(at(10, 14).name === 'grass', 'Offscreen compost did not finish on the new morning');
        check(shop.itemsSold.Corn === 9 && shop.inv[0].amount === 8, 'Morning reset market history before its restock day');
        check(currentLevel_x === 5 && currentLevel_y === 0, 'Player must remain away from the farm');

        const expected = snapshot();
        check(await saveAll(), 'Saving the world from another area failed');
        await worldSaves.flush();
        const stored = (await worldSaves.repository.load(worldSaves.activeWorldId)).data;
        check(stored[home().name].map[11][8].inv.some(item => item && item.name === 'Corn'),
            'Save omitted offscreen robot harvest');
        check(stored.Day_curLvl_Dif.currentLevel_x === 5 && stored.Day_curLvl_Dif.days === 22,
            'Save omitted current location or calendar');
        return expected;
    };

    window.verifyAwayFarmReload = async expected => {
        check(CloudySaveCodec.canonical(snapshot()) === CloudySaveCodec.canonical(expected),
            'Away-farm reload differs: ' + JSON.stringify({ expected, actual: snapshot() }));
        const crop = at(8, 8), shop = at(13, 14);
        const before = crop.growTimer;
        frame();
        check(crop.growTimer === before + 1.25, 'Offscreen growth did not resume after reload');
        time = 1; timephase = 1; frame(true);
        check(shop.inv[0].amount === 8 && shop.itemsSold.Corn === 9 && shop.lastMarketUpdate === 22,
            'Reload caused a premature market restock');
        check(await saveAll(), 'Saving again after reload failed');
        return ['offscreen crop growth and rain', 'offscreen heatwave and sprinklers',
            'offscreen robot movement, fuel, harvest, replanting and watering',
            'pause, rewind and fast-forward simulation boundaries',
            'morning compost and one shop update across sparse areas',
            'save/reload preserves offscreen crops, robot inventory/programs, market history and weather',
            'simulation and saving continue after reload'];
    };
})();
