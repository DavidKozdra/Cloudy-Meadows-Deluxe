// AutoFarm loads a focused subset of the shared Cloudy Meadows asset registry.
// Indices intentionally match preload.js so shared Tile, Item, Robot, Shop,
// Chest, Plant and WEBGL code can consume this array unchanged.

function loadAutoFarmAssets() {
    const img = path => loadImage('../' + path);
    const frames = paths => paths.map(img);
    all_imgs = Array(172).fill(null);

    all_imgs[0] = frames(['images/tiles/Concrete_1.png', 'images/tiles/Concrete2.png']);
    all_imgs[1] = frames(['images/tiles/Grass.png']);
    all_imgs[2] = frames(['images/tiles/Plot.png']);
    all_imgs[3] = frames(['images/tiles/dirt.png']);
    all_imgs[4] = frames(['images/tiles/junk_tile.png']);
    all_imgs[5] = frames(['images/tiles/Wood.png']);
    all_imgs[6] = frames(['images/tiles/Bed.png']);
    all_imgs[12] = frames(['images/tiles/Compost_tile.png']);
    all_imgs[13] = frames(['images/tiles/Worm_Bucket.png']);
    all_imgs[14] = frames(['images/tiles/Shop.png']);
    all_imgs[15] = frames(['images/tiles/Cart.png', 'images/tiles/sp_cart.png']);
    all_imgs[17] = frames(['images/tiles/sprinkler_cart.png']);
    all_imgs[18] = frames(['images/tiles/Cart.png', 'images/tiles/sp_cart.png']);
    all_imgs[19] = frames(['images/tiles/Sprinkler.gif']);
    all_imgs[20] = frames(['images/tiles/CornStage_1.png','images/tiles/CornStage_2.png','images/tiles/CornStage_4.png','images/tiles/CornStage5.png','images/tiles/CornStage6_1.png','images/tiles/Cornstage7.png','images/tiles/CornStage8.png','images/tiles/CornDead.png']);
    all_imgs[21] = frames(['images/tiles/beets_1.png','images/tiles/beets_2.png','images/tiles/beets_3.png','images/tiles/beets_4.png','images/tiles/beets_5.png']);
    all_imgs[22] = frames(['images/tiles/strawberry_1.png','images/tiles/strawberry_2.png','images/tiles/strawberry_3.png','images/tiles/strawberry_4.png','images/tiles/strawberry_5.png','images/tiles/strawberry_6.png']);
    all_imgs[23] = frames(['images/tiles/tomato_1.png','images/tiles/tomato_2.png','images/tiles/tomato_3.png','images/tiles/tomato_4.png','images/tiles/tomato_5.png','images/tiles/tomato_6.png']);
    all_imgs[38] = frames(['images/tiles/Bush.png']);
    all_imgs[39] = img('images/tiles/Chest.png');
    all_imgs[40] = frames(['images/tiles/lettuce_3.png','images/tiles/watermelon_4.png','images/tiles/watermelon_5.png','images/tiles/watermelon_6.png']);
    all_imgs[41] = robotFrames(img, 'robot_back.png', 'robot_right.png', 'robot_front.png', 'robot_left.png');
    all_imgs[42] = frames(['images/tiles/StrawCart.png','images/tiles/tomato_Cart.png','images/tiles/Watermelon_Cart.png']);
    all_imgs[43] = all_imgs[42];
    all_imgs[45] = robotFrames(img, 'robot2_back.png', 'robot2_right.png', 'robot2.png', 'robot2_left.png');
    all_imgs[46] = robotFrames(img, 'robot_water_back.png', 'robot_water_right.png', 'robot_water.png', 'robot_water_left.png');
    all_imgs[47] = frames(['images/tiles/veg_oil_maker.png']);

    const itemPaths = {
        56:'Hoe.png',57:'Corn_item.png',58:'Corn_Seed_bag.png',59:'junk.png',60:'SweetPotato.png',61:'seedbag_sp.png',62:'Stawberry.png',63:'SeedBag_Stawberry.png',64:'Compost.png',65:'Lady_Bug_bag.png',66:'SeedBagFlower.png',67:'Sprinkler.png',68:'FullCourse.png',69:'tomato_bag.png',70:'tomato.png',71:'seedbagwatermelon.png',72:'watermelon2.png',73:'robot.png',74:'floppy_up.png',75:'floppy_right.png',76:'floppy_down.png',77:'floppy_left.png',78:'floppy_interact.png',79:'hemp_seeds.png',80:'hemp.png',81:'floppy_restart.png',82:'robot2.png',83:'robot_water.png',84:'Floppy_addChestt.png',85:'floppy_removechest.png',86:'veg_oil.png',87:'shovel.png',88:'backPack.png',89:'Floppy_Pause.png'
    };
    for (const [index, file] of Object.entries(itemPaths)) all_imgs[index] = img('images/items/' + file);

    all_imgs[93] = frames(['images/tiles/wet_Plot.png']);
    all_imgs[94] = frames(['images/tiles/Grass_Park.png','images/tiles/Grass_Park2.png','images/tiles/Grass_leaves.png']);
    all_imgs[98] = frames(['images/tiles/SideWalk_Path.png']);
    all_imgs[105] = frames(['images/tiles/tree_bottom.png']);
    all_imgs[106] = frames(['images/tiles/tree_top.png']);
    const water = img('images/tiles/water.gif');
    all_imgs[109] = [water, water, img('images/tiles/Flower_water.png'), img('images/tiles/water2.png')];
    all_imgs[120] = img('images/items/Chest.png');
    all_imgs[121] = img('images/items/Grinder.png');
    all_imgs[122] = frames(['images/tiles/Grinder.gif']);
    all_imgs[123] = frames(['images/tiles/tile_shop.png']);
    all_imgs[125] = img('images/items/veg_oil_maker.png');
    all_imgs[126] = frames(['images/tiles/tool_rack.png']);
    all_imgs[127] = frames(['images/npc/Rob_Botus.png']);
    all_imgs[136] = img('images/items/carrot.png');
    all_imgs[137] = img('images/items/seedbag_carrot.png');
    all_imgs[138] = frames(['images/tiles/carrot_1.png','images/tiles/carrot_2.png','images/tiles/carrot_3.png','images/tiles/carrot_4.png']);
    all_imgs[139] = frames(['images/tiles/rock.png']);
    all_imgs[143] = frames(['images/tiles/Pumpkin_1.png','images/tiles/Pumpkin_2.png','images/tiles/Pumpkin_3.png','images/tiles/Pumpkin_4.png','images/tiles/Pumpkin_5.png','images/tiles/Pumpkin_Dead.png']);
    all_imgs[144] = img('images/items/Pumpkin.png');
    all_imgs[145] = img('images/items/Pumpkin_seedBag.png');
    all_imgs[146] = img('images/tiles/Bed.png');
    all_imgs[147] = img('images/tiles/Wood.png');
    all_imgs[148] = img('images/tiles/Worm_Bucket.png');
    all_imgs[163] = img('images/items/Axe.png');
    all_imgs[168] = img('images/items/stop_watch.png');
    all_imgs[169] = img('images/items/flashLight.png');
    all_imgs[170] = img('images/tiles/Wood.png');
    all_imgs[171] = img('images/tiles/rock.png');

    player_imgs = [
        frames(['images/player/Back_Move.png','images/player/BackMove_2.png']),
        frames(['images/player/Right_Move.png','images/player/RightMove2.png']),
        frames(['images/player/Front_moving.png','images/player/front_Move2.png']),
        frames(['images/player/Side_Move.png','images/player/SideMove2.png'])
    ];
    player_2 = loadFont('../pixelFont.ttf');
    inv_img = img('images/ui/Inventory.png');
    inv_hand_img = img('images/ui/Inventory_Frame.png');
    hunger_e = img('images/ui/Corn_empty.png');
    hunger_f = img('images/ui/Corn_Filled.png');
    calendar_img = img('images/ui/Calender.png');
    coin_img = img('images/ui/coin.png');
    battery_low_img = img('images/ui/batteryIcon.png');
    inv_full_img = img('images/ui/inventory_full_warn.png');
    background_img = img('images/Skyline.gif');
    chat_icon = img('images/ui/Chat_Icon.png');
    done_dot = img('images/ui/plant_done_icon.png');
    up_dot = img('images/ui/up_dot_icon.png');
    quest_marker_img = img('images/ui/QuestMarker.png');
    gift_indication_img = img('images/ui/gift_indication.png');
    x_img = img('images/ui/x.png');
}

function robotFrames(img, up, right, down, left) {
    return [[img('images/npc/' + up)], [img('images/npc/' + right)], [img('images/npc/' + down)], [img('images/npc/' + left)]];
}
