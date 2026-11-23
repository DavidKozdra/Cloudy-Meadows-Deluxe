(function (global) {
    'use strict';
    const DEFAULT_WEIGHTS={'frog-rain':.1,thunderstorm:2,rain:8,sunshower:8,overcast:10,'partly-cloudy':15,fog:7,heatwave:1.5,clear:48.4};
    let droplets=[],shimmerPhase=0;
    function getWeights(){const custom=global.customRules&&global.customRules.weatherWeights;if(!custom)return{...DEFAULT_WEIGHTS};const result={};let used=0;for(const key of Object.keys(DEFAULT_WEIGHTS)){if(key==='clear')continue;result[key]=custom[key]==null?DEFAULT_WEIGHTS[key]:Math.max(0,Number(custom[key])||0);used+=result[key];}result.clear=custom.clear==null?Math.max(0,100-used):Math.max(0,Number(custom.clear)||0);return result;}
    // Heatwaves are a rare multi-day event (2-3 days). The span is stored as absolute
    // day numbers so re-rolling the same day (config save) or a Time Watch rewind
    // can neither stretch it nor start it early.
    function inHeatwave(day){const start=global.heatwaveStartDay,end=global.heatwaveEndDay;return typeof start==='number'&&typeof end==='number'&&day>=start&&day<=end;}
    function heatwaveLength(randomValue){return 2+(Math.floor((Number(randomValue)||0)*1e6)%2);}
    function pick(weights,randomValue){const entries=Object.entries(weights),total=entries.reduce((sum,entry)=>sum+entry[1],0);let cursor=Math.max(0,Math.min(.999999,Number(randomValue)||0))*total;for(const[name,weight]of entries){cursor-=weight;if(cursor<=0)return name;}return 'clear';}
    const HISTORY_FIELDS = ['lastRainDay', 'lastFrogRainDay', 'heatwaveStartDay', 'heatwaveEndDay'];

    function history() {
        if (!Array.isArray(global.weatherLog)) global.weatherLog = [];
        return global.weatherLog;
    }

    function recordCurrentDay() {
        if (!Number.isSafeInteger(global.days) || global.days < 0 ||
            !Object.prototype.hasOwnProperty.call(DEFAULT_WEIGHTS, global.currentWeather)) return;
        if (history().some(entry => entry.day === global.days)) return;
        const entry = { day: global.days, weather: global.currentWeather };
        for (const field of HISTORY_FIELDS) {
            entry[field] = Number.isSafeInteger(global[field]) ? global[field] : -999;
        }
        history().push(entry);
    }

    // Weather history outlives the seven world snapshots. Reading a past day
    // neither writes a save nor discards the weather already recorded ahead of it.
    function restoreDay(day) {
        const entry = history().find(record => record.day === day);
        if (!entry) return false;
        global.currentWeather = entry.weather;
        for (const field of HISTORY_FIELDS) global[field] = entry[field];
        droplets = [];
        if (Array.isArray(global.frogRainEntities)) global.frogRainEntities = [];
        return true;
    }

    function loadHistory(savedHistory) {
        global.weatherLog = [];
        const seen = new Set();
        for (const saved of Array.isArray(savedHistory) ? savedHistory : []) {
            if (!saved || !Number.isSafeInteger(saved.day) || saved.day < 0 ||
                !Object.prototype.hasOwnProperty.call(DEFAULT_WEIGHTS, saved.weather) || seen.has(saved.day)) continue;
            const entry = { day: saved.day, weather: saved.weather };
            for (const field of HISTORY_FIELDS) {
                entry[field] = Number.isSafeInteger(saved[field]) ? saved[field] : -999;
            }
            global.weatherLog.push(entry);
            seen.add(entry.day);
        }
        // Older saves only know their current day's weather. Preserve that day
        // without inventing a weather history for days that were never recorded.
        if (!restoreDay(global.days)) recordCurrentDay();
    }

    function roll(randomValue) {
        if (restoreDay(global.days)) return global.currentWeather;
        if (randomValue === undefined) randomValue = Math.random();
        const weights = getWeights();
        let selected;
        if (weights.heatwave > 0 && inHeatwave(global.days)) {
            selected = 'heatwave';
        } else {
            selected = pick(weights, randomValue);
            if (selected === 'heatwave') {
                global.heatwaveStartDay = global.days;
                global.heatwaveEndDay = global.days + heatwaveLength(randomValue) - 1;
            }
        }
        global.currentWeather = selected;
        if (['rain', 'sunshower', 'thunderstorm'].includes(selected)) global.lastRainDay = global.days;
        if (selected === 'frog-rain') global.lastFrogRainDay = global.days;
        recordCurrentDay();
        droplets = [];
        return selected;
    }
    function dayOpacity(base){const daylight=(global.time>100?200-global.time:global.time)/100;return base*(.3+daylight*daylight*.7);}
    function ensureRain(count){if(droplets.length===count)return;droplets=Array.from({length:count},()=>({x:Math.random()*global.canvasWidth,y:Math.random()*global.canvasHeight,vx:-2,vy:5+Math.random()*3,length:8+Math.random()*4,opacity:150+Math.random()*100}));}
    function rain(light,storm){ensureRain(storm?400:200);global.push();for(const drop of droplets){if(!global.paused){drop.x+=drop.vx;drop.y+=drop.vy;if(drop.x>global.canvasWidth)drop.x=-5;if(drop.x< -5)drop.x=global.canvasWidth;if(drop.y>global.canvasHeight){drop.y=-10;drop.x=Math.random()*global.canvasWidth;}}global.stroke(light?150:180,light?200:210,255,drop.opacity*(light?.7:1));global.strokeWeight(storm?1.5:1);global.line(drop.x,drop.y,drop.x+drop.vx*2,drop.y+drop.length);}global.pop();}
    function overlay(red,green,blue,alpha){global.push();global.rectMode(global.CORNER);global.noStroke();global.fill(red,green,blue,alpha);global.rect(0,0,global.canvasWidth,global.canvasHeight);global.pop();}
    // Heatwave shimmer: faint wavy bands of hot air drifting up the screen.
    function heatShimmer(){if(!global.paused)shimmerPhase+=.01;const width=global.canvasWidth,height=global.canvasHeight,bands=5,step=24;global.push();global.stroke(255,230,190,dayOpacity(35));global.strokeWeight(2);for(let b=0;b<bands;b++){const baseY=height-((b/bands+shimmerPhase*.25)%1)*height;let prevX=0,prevY=baseY+Math.sin(shimmerPhase*6+b)*3;for(let x=step;x<=width+step;x+=step){const y=baseY+Math.sin(x*.05+shimmerPhase*6+b)*3;global.line(prevX,prevY,x,y);prevX=x;prevY=y;}}global.pop();}
    // Thunderstorm strike: a subtle white flash plus 1-2 jagged yellow bolts from the top of the screen.
    function lightning(chance=.008){if(Math.random()>=chance)return false;overlay(255,255,255,50);const bolts=Math.random()<.3?2:1,segments=8,step=global.canvasHeight/segments;global.push();global.stroke(255,255,150,180);global.strokeWeight(3);for(let b=0;b<bolts;b++){let x=Math.random()*global.canvasWidth,y=0;for(let i=0;i<segments;i++){const nextX=x+(Math.random()-.5)*60,nextY=y+step;global.line(x,y,nextX,nextY);x=nextX;y=nextY;}}global.pop();return true;}
    function render(){const weather=global.currentWeather||'clear';if(weather==='clear'){droplets=[];return;}if(weather==='partly-cloudy')overlay(0,0,0,dayOpacity(30));else if(weather==='overcast')overlay(0,0,0,dayOpacity(80));else if(weather==='fog')overlay(200,200,200,dayOpacity(100));else if(weather==='sunshower'){overlay(0,0,0,dayOpacity(40));rain(true,false);}else if(weather==='rain'){overlay(0,0,0,dayOpacity(120));rain(false,false);}else if(weather==='thunderstorm'){overlay(0,0,0,dayOpacity(140));rain(false,true);lightning();}else if(weather==='heatwave'){overlay(255,140,40,dayOpacity(55));heatShimmer();}else if(weather==='frog-rain'){overlay(100,200,100,60);if(typeof global.updateFrogRain==='function')global.updateFrogRain();else rain(true,false);}}
    global.CloudyWeather={roll,render,lightning,inHeatwave,restoreDay,loadHistory};
})(window);
