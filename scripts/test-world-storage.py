#!/usr/bin/env python3
"""Real IndexedDB/worker stress tests. Requires Python playwright and psutil.

Example: python3 scripts/test-world-storage.py --worlds 1000 --profiles chromium firefox webkit android iphone
All browser contexts are disposable; no player profile is opened.
"""
import argparse
import asyncio
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import platform
import os
import threading
import time
import psutil
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
    def handle(self):
        try: super().handle()
        except (BrokenPipeError, ConnectionResetError): pass

def browser_rss():
    processes = {}
    for process in psutil.Process().children(recursive=True):
        try:
            if any(name in process.name().lower() for name in ['chrome', 'chromium', 'firefox', 'minibrowser']):
                processes[process.pid] = process
                for child in process.children(recursive=True): processes[child.pid] = child
        except (psutil.NoSuchProcess, psutil.AccessDenied): pass
    total = 0
    for process in processes.values():
        try: total += process.memory_info().rss
        except (psutil.NoSuchProcess, psutil.AccessDenied): pass
    return total

async def prepare_game(page):
    await page.wait_for_selector('#new-game-btn:not([disabled])', timeout=60000)
    await page.wait_for_selector('#boot-loader', state='detached', timeout=30000)
    await page.evaluate('''() => {
        applyAccessibilityPrefs({reduceMotion: true}); scheduleContextualTutorials = () => {}; noLoop();
        setInterval(() => { if (title_screen) showTitle(); else if (dificulty_screen) showDifficultyMenu(); else if (paused) showPaused(); }, 100);
    }''')

async def exercise_game_safety(context, origin):
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    await page.goto(origin + '/farm_game/public/', wait_until='domcontentloaded')
    await prepare_game(page)
    await page.locator('#new-game-btn').click()
    await page.locator('[data-world-slot="1"] .world-slot-play').click()
    await page.evaluate('() => { worldSaves.repository.options.transactionHook = tx => tx.abort(); }')
    await page.locator('.difficulty-select-btn[data-difficulty="0"]').click()
    await page.wait_for_function('worldSaves.status === "error" && paused && pendingNewWorld !== null')
    await page.evaluate('worldSaves.repository.options.transactionHook = null')
    await page.locator('#world-save-notice').get_by_role('button', name='Retry Save', exact=True).click()
    await page.wait_for_function('!title_screen && !dificulty_screen && !paused')
    assert await page.evaluate('pendingNewWorld === null')
    await page.evaluate('''async () => {
        startBridgeTutorial();
        if (!window.bridgeTutorialActive) throw new Error('Bridge tutorial did not start');
        updateBridgeTutorialState({ name: 'Crossed into the next room' });
        if (window.bridgeTutorialActive || !hasSeenBridgeTutorial()) throw new Error('Bridge tutorial completion did not persist');
        await worldSaves.flush();
        if ((await worldSaves.repository.load(worldSaves.activeWorldId)).data.BridgeTutorialSeen !== true)
            throw new Error('Bridge tutorial flag prevented saving');
        if (buildSaveExportPayload().data.BridgeTutorialSeen !== true) throw new Error('Copy export omitted the tutorial flag');
        player.coins = 217; player.quests[0].storageTestProgress = 8;
        player.talking = { name: 'Conversation', playerReference: player };
        if (!await saveAll()) throw new Error('Conversation save failed');
        const saved = (await worldSaves.repository.load(worldSaves.activeWorldId)).data.player;
        if (saved.coins !== 217 || saved.quests[0].storageTestProgress !== 8 || saved.talking !== 0 || !player.talking)
            throw new Error('Player progress was omitted during a conversation');
        player.talking = 0;
        paused = true; showPaused(); save_anim = 0; player.coins = 333;
        worldSaves.repository.options.transactionHook = tx => tx.abort();
        await saveAndQuitWorld();
        if (title_screen || save_anim !== 0 || worldSaves.status !== 'error') throw new Error('Quit or Saved occurred after a failed save');
        if ((await worldSaves.repository.load(worldSaves.activeWorldId)).data.player.coins !== 217) throw new Error('Failed quit changed the original');
    }''')
    async with page.expect_download() as pending_download:
        await page.locator('#world-save-notice').get_by_role('button', name='Download Backup', exact=True).click()
    download = await pending_download.value
    backup = json.loads(Path(await download.path()).read_text())
    assert backup['format'] == 'cloudy-meadows-save' and backup['version'] == 2
    assert backup['data']['player']['coins'] == 333 and len(backup['data']['levels']) > 20
    assert backup['data']['BridgeTutorialSeen'] is True
    future = {**backup, 'version': 999}
    error = await page.evaluate('text => importSaveDataFromText(text).then(() => null, error => error.message)', json.dumps(future))
    assert error and 'version' in error
    broken = json.loads(json.dumps(backup)); broken['data']['player']['quests'][0]['goals'] = None
    error = await page.evaluate('text => importSaveDataFromText(text).then(() => null, error => error.message)', json.dumps(broken))
    assert error and 'quest' in error
    assert await page.evaluate('(async () => (await worldSaves.repository.load(worldSaves.activeWorldId)).data.player.coins)()') == 217
    await page.evaluate('''async () => {
        worldSaves.repository.options.transactionHook = null;
        player.coins = 777;
        await saveAndQuitWorld();
        if (!title_screen || worldSaves.summary(1).coins !== 777) throw new Error('Successful quit did not commit first');
    }''')
    backup['data']['Options'] = {'musicVolume': .37}
    (ROOT / 'artifacts' / 'storage-safety-backup.json').write_text(json.dumps(backup))
    await page.evaluate('''backup => {
        const data = { ...backup.data, ...backup.data.levels };
        delete data.levels; delete data.Options; delete data.Controls;
        CloudySaveCodec.validateImport(data);
    }''', backup)
    async with page.expect_navigation(wait_until='domcontentloaded'):
        await page.evaluate('text => { importSaveDataFromText(text).catch(error => { window.importFailure = error.message; }); }', json.dumps(backup))
    await prepare_game(page)
    await page.evaluate('''async () => {
        const head = await worldSaves.repository.getBySlot(1);
        const data = (await worldSaves.repository.load(head.id)).data;
        if (data.player.coins !== 333 || head.summary.coins !== 333) throw new Error('Downloaded backup did not round-trip');
        if (data.BridgeTutorialSeen !== true) throw new Error('Import lost bridge tutorial completion');
        const options = await worldSaves.repository.get('settings', 'Options');
        if (options.value.musicVolume !== .37) throw new Error('Import reloaded before settings committed');
    }''')
    await page.locator('#new-game-btn').click()
    await page.locator('[data-world-slot="2"] .world-slot-play').click()
    await page.locator('.difficulty-select-btn[data-difficulty="2"]').click()
    await page.wait_for_function('!title_screen && !dificulty_screen && !paused')
    await page.evaluate('''async () => {
        if (hasSeenBridgeTutorial() || window.bridgeTutorialActive) throw new Error('Tutorial progress leaked into another world');
        const original = await worldSaves.repository.getBySlot(1);
        const death = player.endRunAfterDeath();
        if (!worldMenuBusy) throw new Error('World switching was allowed during deletion');
        await death;
        if (worldMenuBusy || await worldSaves.repository.getBySlot(2)) throw new Error('Death did not complete deletion');
        if ((await worldSaves.repository.getBySlot(1)).revision !== original.revision) throw new Error('Death affected another world');
        const copy = (await worldSaves.repository.load(original.id)).data;
        await worldSaves.activate(1000); await worldSaves.replace(copy);
        await showWorldPicker('continue');
    }''')
    assert await page.locator('[data-world-slot="1000"]').count() == 1
    assert await page.locator('[data-world-slot]').count() == 2
    assert await page.get_by_role('button', name='Next page', exact=True).count() == 0
    assert not errors, errors
    await page.close()
    return ['bridge tutorial completion saves and survives export/import without crossing worlds', 'new-game failure can retry', 'conversation progress saved', 'failed Save and Quit stays in game', 'unsaved progress downloadable',
            'future import version and malformed quests rejected', 'successful Save and Quit waits', 'download/import round-trip with settings',
            'permadeath deletion completes before switching', 'sparse slots remain visible after deletion']

async def exercise_offline_safety(browser, origin):
    context = await browser.new_context(service_workers='allow')
    try:
        page = await context.new_page()
        await page.goto(origin + '/farm_game/public/', wait_until='domcontentloaded')
        await prepare_game(page)
        await page.evaluate('navigator.serviceWorker.ready')
        await page.wait_for_function('navigator.serviceWorker.controller !== null')
        # Warm external assets through the installed service worker as well.
        await page.reload(wait_until='domcontentloaded')
        await prepare_game(page)
        await page.locator('#new-game-btn').click()
        await page.locator('[data-world-slot="1"] .world-slot-play').click()
        await page.locator('.difficulty-select-btn[data-difficulty="0"]').click()
        await page.wait_for_function('!title_screen && !dificulty_screen && !paused')
        await page.evaluate('async () => { player.coins = 815; if (!await saveAll()) throw new Error("Online setup save failed"); }')
        await context.set_offline(True)
        await page.reload(wait_until='domcontentloaded')
        await prepare_game(page)
        await page.locator('#start-btn').click()
        await page.wait_for_function('!title_screen')
        await page.evaluate('''async () => {
            if (player.coins !== 815) throw new Error('Offline reload lost saved progress');
            player.coins = 816;
            if (!await saveAll()) throw new Error('Offline save worker failed');
            if ((await worldSaves.repository.load(worldSaves.activeWorldId)).data.player.coins !== 816) throw new Error('Offline commit did not persist');
        }''')
        return ['offline reload', 'offline worker compression and save']
    finally:
        await context.close()

async def exercise_away_farm(context, origin):
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    fixture = ROOT / 'farm_game/tests/browser/away-farm.js'
    try:
        await page.goto(origin + '/farm_game/public/', wait_until='domcontentloaded')
        await prepare_game(page)
        await page.locator('#new-game-btn').click()
        await page.locator('[data-world-slot="1"] .world-slot-play').click()
        await page.locator('.difficulty-select-btn[data-difficulty="0"]').click()
        await page.wait_for_function('!title_screen && !dificulty_screen && !paused')
        await page.add_script_tag(path=str(fixture))
        expected = await page.evaluate('exerciseAwayFarm()')
        await page.reload(wait_until='domcontentloaded')
        await prepare_game(page)
        await page.locator('#start-btn').click()
        await page.wait_for_function('!title_screen && !paused')
        await page.add_script_tag(path=str(fixture))
        checks = await page.evaluate('expected => verifyAwayFarmReload(expected)', expected)
        assert not errors, errors
        return checks
    finally:
        await page.close()

async def run_profile(p, origin, profile, count, webkit_library_path=None, safety_only=False, simulation_only=False):
    engine = {'android':'chromium', 'iphone':'webkit'}.get(profile, profile)
    launch = {'headless': True}
    if engine == 'webkit' and webkit_library_path:
        # The bundled shell wrapper overwrites LD_LIBRARY_PATH. Launch its binary
        # with the same bundle paths plus the optional host compatibility libs.
        bundle = Path(p.webkit.executable_path).parent / 'minibrowser-wpe'
        launch.update(executable_path=str(bundle / 'bin' / 'MiniBrowser'), env={**os.environ,
            'LD_LIBRARY_PATH': f'{bundle}/lib:{bundle}/sys/lib:{webkit_library_path}',
            'WEBKIT_EXEC_PATH': str(bundle / 'bin'), 'WEBKIT_INJECTED_BUNDLE_PATH': str(bundle / 'lib'),
            'WEBKIT_INSPECTOR_RESOURCES_PATH': str(bundle / 'share'), 'WEBKIT_FORCE_COMPLEX_TEXT': '1'})
    browser = await getattr(p, engine).launch(**launch)
    device = p.devices['Pixel 7'] if profile == 'android' else p.devices['iPhone 13'] if profile == 'iphone' else {'viewport':{'width':1440,'height':900}}
    context = await browser.new_context(**device, service_workers='block')
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    url = origin + '/farm_game/tests/browser/storage.html'
    await page.goto(url)
    peak_rss = 0
    sampling = True
    async def sample():
        nonlocal peak_rss
        while sampling:
            peak_rss = max(peak_rss, browser_rss())
            await asyncio.sleep(.5)
    sampler = asyncio.create_task(sample())
    started = time.monotonic()
    try:
        if simulation_only:
            checks = await exercise_away_farm(context, origin)
            assert not errors, errors
            report = {'profile': profile, 'engine': engine, 'browserVersion': browser.version,
                      'simulationTests': checks, 'pageErrors': errors}
            print(json.dumps({'stage': 'simulation complete', **report}), flush=True)
            return report
        if safety_only:
            safety = await page.evaluate('runStorageSafety()')
            game_safety = await exercise_game_safety(context, origin)
            offline = await exercise_offline_safety(browser, origin) if profile == 'chromium' else []
            assert not errors, errors
            report = {'profile': profile, 'engine': engine, 'browserVersion': browser.version,
                      'safetyTests': safety, 'gameTests': game_safety, 'offlineTests': offline, 'pageErrors': errors}
            print(json.dumps({'stage': 'safety complete', **report}), flush=True)
            return report
        setup = await page.evaluate('(count) => setupStress(count)', count)
        print(json.dumps({'profile':profile, 'stage':'setup', **setup}), flush=True)
        for start in range(1, count+1, 20):
            result = await page.evaluate('([start,end]) => createBatch(start,end)', [start, min(count,start+19)])
            print(json.dumps({'profile':profile,'stage':'create',**result}), flush=True)
        saved_state = await page.evaluate('stressState()')
        await page.reload()
        await page.evaluate('(state) => resumeStress(state)',saved_state)
        for start in range(1, count+1, 20):
            result = await page.evaluate('([start,end]) => verifyBatch(start,end)', [start,min(count,start+19)])
            print(json.dumps({'profile':profile,'stage':'verify',**result}), flush=True)
        failures = await page.evaluate('exerciseFailures()')
        print(json.dumps({'profile':profile,'stage':'faults','passed':failures}), flush=True)
        print(json.dumps({'profile':profile,'stage':'random operations'}),flush=True)
        randomized = await page.evaluate('randomOperations(60)')
        print(json.dumps({'profile':profile,'stage':'migration and manager'}),flush=True)
        migration = await page.evaluate('migrationAndManagerTests()')
        print(json.dumps({'profile':profile,'stage':'two-tab race'}),flush=True)
        other = await context.new_page()
        await other.goto(url)
        target = await page.evaluate('(async () => (await repository.getBySlot(1)).id)()')
        await asyncio.gather(page.evaluate('(id) => prepareRace(id)',target),other.evaluate('(id) => prepareRace(id)',target))
        race = await asyncio.gather(page.evaluate('commitRace(87111)'),other.evaluate('commitRace(98222)'))
        assert sorted(race) == ['ConflictError','saved'], race
        await page.evaluate('updateExpected(1)')
        # Start real writes, keep their transaction active, then close the tab.
        print(json.dumps({'profile':profile,'stage':'tab-close interruption'}),flush=True)
        await other.evaluate('(id) => interruptibleSave(id)', target)
        await other.wait_for_function('window.transactionStarted === true')
        await other.close()
        print(json.dumps({'profile':profile,'stage':'closed tab; checking rollback'}),flush=True)
        await page.evaluate('verifyOne(1)')
        # Recheck every world after random mutations, deletion/import, races and interruption.
        for start in range(1,count+1,20):
            await page.evaluate('([start,end]) => verifyBatch(start,end)', [start,min(count,start+19)])
            if start % 100 == 1: print(json.dumps({'profile':profile,'stage':'final-verify','through':min(count,start+19)}),flush=True)
        game = await context.new_page()
        game.on('pageerror',lambda error: errors.append(str(error)))
        await game.goto(origin + '/farm_game/public/', wait_until='domcontentloaded')
        await game.wait_for_selector('#start-btn:not([hidden]):not([disabled])',timeout=60000)
        await game.wait_for_selector('#boot-loader',state='detached',timeout=30000)
        await game.evaluate('() => { noLoop(); showTitle(); }')
        menu_start = time.monotonic()
        await game.locator('#start-btn').click()
        await game.wait_for_selector('[data-world-slot]')
        menu_ms = (time.monotonic()-menu_start)*1000
        assert await game.locator('[data-world-slot]').count() == min(3,count)
        assert await game.evaluate('worldSaves.repository.metrics.recordReads') == 0, 'Menu read full worlds'
        if count > 3:
            await game.get_by_role('button',name='Next page',exact=True).click()
            await game.wait_for_selector('[data-world-slot="4"]')
            assert await game.locator('[data-world-slot]').count() == 3
        screenshot = ROOT / 'artifacts' / f'storage-menu-{profile}.png'
        screenshot.parent.mkdir(exist_ok=True)
        await game.screenshot(path=str(screenshot))
        report = await page.evaluate('stressReport()')
        report.update(profile=profile,engine=engine,browserVersion=browser.version,phoneEmulation=profile in ['android','iphone'],
                      fixtureBytes=setup['fixtureBytes'],failureTests=failures,randomized=randomized,migrationTests=migration,
                      race=race,tabCloseRollback=True,menuMs=menu_ms,peakBrowserProcessRssBytes=peak_rss,
                      elapsedSeconds=time.monotonic()-started,pageErrors=errors)
        assert not errors, errors
        print(json.dumps({'profile':profile,'stage':'complete','report':report}),flush=True)
        return report
    finally:
        sampling=False
        await sampler
        await browser.close()

async def main(args):
    server = ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    origin=f'http://127.0.0.1:{server.server_port}'
    report={'platform':platform.platform(),'worldCountPerProfile':0 if args.safety_only or args.simulation_only else args.worlds,
            'memoryMeasurement':'Peak sum of browser process RSS, including workers/GPU and shared pages; not JavaScript heap alone.',
            'phoneMeasurement':'Device/touch emulation on the host, not physical phone hardware.','profiles':[]}
    output=ROOT/args.output; output.parent.mkdir(parents=True,exist_ok=True)
    try:
        async with async_playwright() as p:
            for profile in args.profiles:
                report['profiles'].append(await run_profile(p,origin,profile,args.worlds,args.webkit_library_path,args.safety_only,args.simulation_only))
                output.write_text(json.dumps(report,indent=2)+'\n')
    finally: server.shutdown()

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--worlds',type=int,default=1000)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--safety-only',action='store_true',help='Run focused recovery/upgrade and actual-game save/backup checks')
    mode.add_argument('--simulation-only',action='store_true',help='Run actual-game offscreen farm simulation and save/reload checks')
    parser.add_argument('--profiles',nargs='+',choices=['chromium','firefox','webkit','android','iphone'],default=['chromium','firefox','webkit','android','iphone'])
    parser.add_argument('--webkit-library-path',help='Optional Linux compatibility-library directory for the installed WebKit browser')
    parser.add_argument('--output',default='artifacts/storage-stress-report.json')
    args=parser.parse_args()
    asyncio.run(main(args))
