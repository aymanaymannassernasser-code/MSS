// Motor Starter Simulator - Professional Edition
// By: Ayman Elkhodary
// Physics: J × dω/dt = T_net, V ∝ I (linear), T ∝ V² ∝ I²

// 36 S_POINTS: every 5% from 0-70%, increasing density 70-100%
// Rationale: motor curve changes rapidly near synchronous speed
// Presets computed from original 19-point data via cubic spline interpolation
const S_POINTS = [0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,73,76,79,82,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100];

const PRESETS = {
    motor: {
        oem:     [80,80,80,80,80,80,80,80,80,80,80,80,81,83,89,94,99,106,114,121,126,131,136,141,146,152,159,166,174,178,176,173,159,125,67,0],
        designC: [250,246,240,230,220,212,205,199,195,192,190,190,192,195,200,204,209,213,230,245,251,255,258,260,257,250,242,230,210,185,153,120,90,60,30,0],
        highSlip:[160,161,162,163,165,168,170,173,175,178,185,192,200,208,215,220,224,227,230,235,238,240,243,245,242,235,228,215,200,185,165,150,125,100,60,0]
    },
    current: {
        oem:     [590,588,585,582,580,578,577,576,574,572,570,567,565,564,562,559,556,551,540,525,516,505,493,480,466,450,434,415,392,360,311,255,205,150,82,10],
        designC: [550,548,545,542,538,534,530,525,520,515,510,505,500,493,485,480,475,468,455,435,421,405,389,370,346,320,296,270,241,210,175,140,107,75,43,10],
        highSlip:[620,615,610,605,600,593,585,578,570,562,550,538,525,513,500,492,484,477,465,445,432,420,405,385,360,335,308,280,247,210,180,155,125,100,65,10]
    },
    load: {
        oem:        [12,9,7,6,6,6,7,8,9,10,12,14,16,18,21,23,25,26,28,30,31,31,32,33,34,34,35,36,37,37,38,39,40,40,41,42],
        centrifugal:[5,5,6,7,8,10,12,14,17,20,23,26,30,34,38,41,44,47,51,54,56,58,60,62,64,67,70,73,76,80,84,88,92,95,98,100],
        constant:   [40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40]
    }
};

let chart = null;
let axesSwapped = false; // false = Current left / Torque right (NEW DEFAULT)
let thermalMode = 'percent';
let simulationMode = 'DOL';
let lastSimResults = null;
let useSpline = true;

// LINEAR interpolation
function interpolateLinear(x, xArr, yArr) {
    x = parseFloat(x);
    if (x <= xArr[0]) return parseFloat(yArr[0]);
    if (x >= xArr[xArr.length - 1]) return parseFloat(yArr[yArr.length - 1]);
    
    for (let i = 1; i < xArr.length; i++) {
        if (x <= xArr[i]) {
            let x0 = xArr[i-1], x1 = xArr[i];
            let y0 = parseFloat(yArr[i-1]), y1 = parseFloat(yArr[i]);
            return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
        }
    }
    return parseFloat(yArr[yArr.length - 1]);
}

// CUBIC SPLINE (Monotonic - Fritsch-Carlson)
function createMonotonicSpline(xArr, yArr) {
    const n = xArr.length - 1;
    const h = [], delta = [], m = new Array(n + 1);
    
    for (let i = 0; i < n; i++) {
        h[i] = xArr[i + 1] - xArr[i];
        delta[i] = (parseFloat(yArr[i + 1]) - parseFloat(yArr[i])) / h[i];
    }
    
    m[0] = delta[0];
    for (let i = 1; i < n; i++) {
        m[i] = (delta[i-1] + delta[i]) / 2;
        if (delta[i-1] * delta[i] <= 0) {
            m[i] = 0;
        } else {
            const alpha = m[i] / delta[i-1];
            const beta = m[i] / delta[i];
            if (alpha * alpha + beta * beta > 9) {
                const tau = 3 / Math.sqrt(alpha * alpha + beta * beta);
                m[i] = tau * delta[i-1];
            }
        }
    }
    m[n] = delta[n-1];
    
    return { x: xArr, y: yArr, m: m, h: h };
}

function evaluateMonotonicSpline(spline, x) {
    x = parseFloat(x);
    const n = spline.x.length - 1;
    if (x <= spline.x[0]) return parseFloat(spline.y[0]);
    if (x >= spline.x[n]) return parseFloat(spline.y[n]);
    
    let i = 0;
    for (let j = 0; j < n; j++) {
        if (x >= spline.x[j] && x <= spline.x[j + 1]) {
            i = j;
            break;
        }
    }
    
    const h = spline.h[i];
    const t = (x - spline.x[i]) / h;
    const y0 = parseFloat(spline.y[i]);
    const y1 = parseFloat(spline.y[i + 1]);
    const m0 = spline.m[i];
    const m1 = spline.m[i + 1];
    
    const h00 = (1 + 2*t) * (1 - t) * (1 - t);
    const h10 = t * (1 - t) * (1 - t);
    const h01 = t * t * (3 - 2*t);
    const h11 = t * t * (t - 1);
    
    return h00 * y0 + h10 * h * m0 + h01 * y1 + h11 * h * m1;
}

function interpolate(x, xArr, yArr) {
    if (useSpline) {
        const key = yArr.join(',');
        if (!window.splineCache) window.splineCache = {};
        if (!window.splineCache[key]) {
            window.splineCache[key] = createMonotonicSpline(xArr, yArr);
        }
        return evaluateMonotonicSpline(window.splineCache[key], x);
    } else {
        return interpolateLinear(x, xArr, yArr);
    }
}

function init() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "";
    S_POINTS.forEach((s, i) => {
        tbody.innerHTML += `<tr><td><b>${s}%</b></td>
            <td><input type="number" class="val-mt" value="${PRESETS.motor.oem[i]}"></td>
            <td><input type="number" class="val-mc" value="${PRESETS.current.oem[i]}"></td>
            <td><input type="number" class="val-lt" value="${PRESETS.load.oem[i]}"></td></tr>`;
    });

    // Check if returning from digitizer with data
    const digitizerData = localStorage.getItem('digitizerData');
    if (digitizerData) {
        try {
            const data = JSON.parse(digitizerData);
            const mts = document.querySelectorAll('.val-mt');
            const mcs = document.querySelectorAll('.val-mc');
            const lts = document.querySelectorAll('.val-lt');
            const N = S_POINTS.length; // 36
            let applied = 0;
            if (data.mt && data.mt.length === N) { data.mt.forEach((v, i) => mts[i].value = v); applied++; }
            if (data.mc && data.mc.length === N) { data.mc.forEach((v, i) => mcs[i].value = v); applied++; }
            if (data.lt && data.lt.length === N) { data.lt.forEach((v, i) => lts[i].value = v); applied++; }
            localStorage.removeItem('digitizerData');
            if (applied > 0) {
                window.splineCache = {};
                showImportBanner(applied);
            }
        } catch(e) { localStorage.removeItem('digitizerData'); }
    }

    document.getElementById('motorPreset').onchange = (e) => applyPreset('motor', e.target.value);
    document.getElementById('loadPreset').onchange = (e) => applyPreset('load', e.target.value);
    document.getElementById('btnSimulate').onclick = runSimulation;
    document.getElementById('btnSaveCase').onclick = saveCase;
    document.getElementById('btnClearCases').onclick = clearLibrary;
    document.getElementById('btnExportPDF').onclick = exportToPDF;
    document.getElementById('caseDropdown').onchange = loadCase;
    document.getElementById('thermalToggle')?.addEventListener('click', toggleThermal);
    document.getElementById('splineToggle')?.addEventListener('click', toggleSpline);
    document.getElementById('resultTime')?.addEventListener('blur', onStartTimeEdit);
    document.getElementById('resultTime')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') onStartTimeEdit();
    });
    document.getElementById('modeDOL')?.addEventListener('click', () => setMode('DOL'));
    document.getElementById('modeSS')?.addEventListener('click', () => setMode('SS'));
    document.getElementById('motorJ')?.addEventListener('input', updateCombinedJ);
    document.getElementById('loadJ')?.addEventListener('input', updateCombinedJ);

    loadCaseList();
    updateHeader();
    updateCombinedJ();
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
}

function toggleSpline() {
    useSpline = !useSpline;
    window.splineCache = {};
    const btn = document.getElementById('splineToggle');
    if (btn) btn.textContent = useSpline ? 'Cubic ✓' : 'Linear ✓';
    document.getElementById('interpolationMethod').innerText = useSpline ? 'Cubic Spline' : 'Linear';
}

function onStartTimeEdit() {
    if (simulationMode !== 'SS') return;
    const timeField = document.getElementById('resultTime');
    const timeText = timeField.innerText;
    const timeMatch = timeText.match(/(\d+\.?\d*)/);
    if (!timeMatch) return;
    const targetTime = parseFloat(timeMatch[1]);
    if (isNaN(targetTime) || targetTime <= 0) return;
    solveForCurrentFromTime(targetTime);
}

function updateCombinedJ() {
    const motorJ = parseFloat(document.getElementById('motorJ')?.value) || 0;
    const loadJ = parseFloat(document.getElementById('loadJ')?.value) || 0;
    document.getElementById('totalJ').innerText = (motorJ + loadJ).toFixed(2);
}

function setMode(mode) {
    simulationMode = mode;
    document.getElementById('modeDOL').className = mode === 'DOL' ? 'mode-btn active' : 'mode-btn';
    document.getElementById('modeSS').className = mode === 'SS' ? 'mode-btn active' : 'mode-btn';
    document.getElementById('ssControls').style.display = mode === 'SS' ? 'block' : 'none';
}

function toggleThermal() {
    thermalMode = thermalMode === 'percent' ? 'absolute' : 'percent';
    const btn = document.getElementById('thermalToggle');
    if (btn) btn.textContent = thermalMode === 'percent' ? '→ I²t' : '→ %';
    if (lastSimResults) displayResults(lastSimResults);
}

function applyPreset(type, key) {
    if (key === 'current') return;
    window.splineCache = {};
    const mts = document.querySelectorAll('.val-mt'), mcs = document.querySelectorAll('.val-mc'), lts = document.querySelectorAll('.val-lt');
    if (type === 'motor') {
        PRESETS.motor[key].forEach((v, i) => mts[i].value = v);
        PRESETS.current[key].forEach((v, i) => mcs[i].value = v);
    } else {
        PRESETS.load[key].forEach((v, i) => lts[i].value = v);
    }
}

function updateHeader() {
    const kw = parseFloat(document.getElementById('mKW').value) || 0;
    const rpm = parseFloat(document.getElementById('mRPM').value) || 1;
    const poles = parseFloat(document.getElementById('mPoles').value) || 4;
    const freq = parseFloat(document.getElementById('mFreq').value) || 50;
    document.getElementById('resFLT').innerText = ((kw * 9550) / rpm).toFixed(1);
    document.getElementById('resSyncSpeed').innerText = ((120 * freq) / poles).toFixed(0);
}

function calculateMinStartingCurrent(tableMt, tableMc, tableLt) {
    // Find minimum current where net torque stays positive throughout curve
    // NO SAFETY MARGIN — returns actual physical minimum
    for (let testCurrent = 200; testCurrent <= 700; testCurrent += 2) {
        let minNetTorque = 999, stallDetected = false, criticalSpeedPoint = 0;
        
        for (let i = 0; i < S_POINTS.length; i++) {
            if (S_POINTS[i] >= 95) continue;
            let motorTorque = parseFloat(tableMt[i]);
            let motorCurrent = parseFloat(tableMc[i]);
            let loadTorque = parseFloat(tableLt[i]);
            let vr = Math.min(1.0, testCurrent / motorCurrent);
            let netTorque = motorTorque * vr * vr - loadTorque;
            
            if (netTorque < minNetTorque) {
                minNetTorque = netTorque;
                criticalSpeedPoint = S_POINTS[i];
            }
            if (netTorque < 0) {
                stallDetected = true;
                break;
            }
        }
        // Return first current where all net torque ≥ 0 (no safety margin)
        if (!stallDetected && minNetTorque >= 0.0) {
            return { current: testCurrent, criticalSpeed: criticalSpeedPoint };
        }
    }
    return { current: 700, criticalSpeed: 0 };
}

// CRITICAL FIX: Comprehensive stall detection
function runSimulationCore(mode, ssInitialI, ssFinalI, ssRampTime, returnData = false) {
    const mRPM = parseFloat(document.getElementById('mRPM').value);
    const mFLC = parseFloat(document.getElementById('mFLC').value);
    const motorJ = parseFloat(document.getElementById('motorJ')?.value) || 0;
    const loadJ = parseFloat(document.getElementById('loadJ')?.value) || 0;
    const totalJ = motorJ + loadJ;
    
    if (totalJ <= 0) {
        alert('ERROR: Total inertia must be > 0');
        return { time: 60, isStalled: true, stallReason: "Invalid Inertia" };
    }
    
    const fltNm = parseFloat(document.getElementById('resFLT').innerText);
    const hStall = parseFloat(document.getElementById('hStall').value);
    const freq = parseFloat(document.getElementById('mFreq').value) || 50;
    const poles = parseFloat(document.getElementById('mPoles').value) || 4;
    
    const tableMt = [...document.querySelectorAll('.val-mt')].map(e => e.value);
    const tableMc = [...document.querySelectorAll('.val-mc')].map(e => e.value);
    const tableLt = [...document.querySelectorAll('.val-lt')].map(e => e.value);
    
    const ns = (120 * freq) / poles;
    const targetRadS = (mRPM * 2 * Math.PI) / 60;
    const lockedRotorCurrentAmps = (parseFloat(tableMc[0]) / 100) * mFLC;
    
    if (mode === 'SS') {
        if (ssInitialI === ssFinalI || ssRampTime === 0 || !ssRampTime) {
            ssRampTime = 0;
            ssFinalI = ssInitialI;
        }
    }

    let time = 0, speedPerc = 0, thermal = 0, thermalAbsRaw = 0;
    let minNet = 999, criticalNetSpeed = 0;
    let isStalled = false, stallSpd = null, stallReason = "";
    let speedRadS = 0, rampEndSpeed = 0;
    const dt = 0.01;
    
    // For hung detection
    let lastSpeedCheck = 0;
    let lastSpeedValue = 0;

    while (time < 60 && speedPerc < 99) {
        let motorTorquePct = interpolate(speedPerc, S_POINTS, tableMt);
        let motorCurrentPct = interpolate(speedPerc, S_POINTS, tableMc);
        let loadTorquePct = interpolate(speedPerc, S_POINTS, tableLt);
        
        let actualMotorTorquePct = motorTorquePct;
        let actualMotorCurrentPct = motorCurrentPct;
        
        if (mode === 'SS') {
            let currentLimit;
            if (ssRampTime > 0 && time <= ssRampTime) {
                currentLimit = ssInitialI + (ssFinalI - ssInitialI) * (time / ssRampTime);
                if (rampEndSpeed === 0 && time >= ssRampTime - dt) {
                    rampEndSpeed = speedPerc;
                }
            } else {
                currentLimit = ssFinalI;
            }
            // CORRECT: V ∝ I (linear), then T ∝ V² ∝ I²
            let voltageRatio = Math.min(1.0, currentLimit / motorCurrentPct);
            actualMotorTorquePct = motorTorquePct * voltageRatio * voltageRatio;
            actualMotorCurrentPct = motorCurrentPct * voltageRatio;
        }
        
        let netTorquePct = actualMotorTorquePct - loadTorquePct;
        
        if (speedPerc < 95 && netTorquePct < minNet) {
            minNet = netTorquePct;
            criticalNetSpeed = speedPerc;
        }
        
        // COMPREHENSIVE STALL DETECTION (applies throughout entire start, not just <98%)
        if (!isStalled) {
            // 1. NEGATIVE NET TORQUE (motor can't overcome load)
            if (netTorquePct < 0) {
                console.error(`🛑 STALL: Negative Net Torque at ${speedPerc.toFixed(1)}% speed`);
                console.error(`  Motor Torque: ${actualMotorTorquePct.toFixed(1)}%`);
                console.error(`  Load Torque: ${loadTorquePct.toFixed(1)}%`);
                console.error(`  Net Torque: ${netTorquePct.toFixed(1)}%`);
                console.error(`  Mode: ${mode}, Time: ${time.toFixed(2)}s`);
                isStalled = true;
                stallReason = "Insufficient Torque (Negative)";
                stallSpd = speedPerc;
                break;
            }
            
            // 2. CRITICALLY LOW NET TORQUE (< 0.5%, essentially stuck)
            if (netTorquePct < 0.5 && speedPerc < 95) {
                isStalled = true;
                stallReason = "Insufficient Torque (<0.5%)";
                stallSpd = speedPerc;
                break;
            }
            
            // 3. THERMAL OVERLOAD
            if (thermal >= 100) {
                isStalled = true;
                stallReason = "Thermal Overload";
                stallSpd = speedPerc;
                break;
            }
            
            // 4. HUNG (speed not progressing - check every 1.5 seconds)
            if (time - lastSpeedCheck >= 1.5) {
                if (Math.abs(speedPerc - lastSpeedValue) < 0.3 && time > 2.0) {
                    isStalled = true;
                    stallReason = "Hung (No Acceleration)";
                    stallSpd = speedPerc;
                    break;
                }
                lastSpeedCheck = time;
                lastSpeedValue = speedPerc;
            }
            
            // 5. CREEPING (very slow progress, insufficient current)
            if (time > 20 && speedPerc < 50) {
                isStalled = true;
                stallReason = "Too Slow (Creeping - Insufficient Current)";
                stallSpd = speedPerc;
                break;
            }
            
            // 6. EXCESSIVE TIME (max 30s OR 2× hot stall, whichever is less)
            const maxAllowedTime = Math.min(30, hStall * 2);
            if (time > maxAllowedTime && speedPerc < 95) {
                isStalled = true;
                stallReason = `Timeout (>${maxAllowedTime.toFixed(0)}s)`;
                stallSpd = speedPerc;
                break;
            }
        }
        
        if (isStalled) break;
        
        // Physics continues ALL THE WAY to 99% (not 98.5%!)
        if (speedPerc < 99) {
            // Physics: J × dω/dt = T_net
            let netTorqueNm = (netTorquePct / 100.0) * fltNm;
            let angularAccel = netTorqueNm / totalJ;
            speedRadS += angularAccel * dt;
            speedPerc = (speedRadS / targetRadS) * 100.0;
            
            // Thermal accumulation: I²t
            let actualCurrentAmps = (actualMotorCurrentPct / 100.0) * mFLC;
            thermalAbsRaw += actualCurrentAmps * actualCurrentAmps * dt;
            thermal = (thermalAbsRaw / (lockedRotorCurrentAmps * lockedRotorCurrentAmps * hStall)) * 100.0;
        }
        
        time += dt;
    }
    
    if (returnData) {
        return {
            time, isStalled, stallReason, thermal, thermalAbs: thermalAbsRaw,
            minNet, criticalNetSpeed, finalSlip: 1 - (speedPerc / 100),
            ns, stallSpd, rampEndSpeed
        };
    }
    return { time, isStalled, stallReason };
}

function runSimulation() {
    window.splineCache = {};
    updateHeader();
    
    const mFLC = parseFloat(document.getElementById('mFLC').value);
    const fltNm = parseFloat(document.getElementById('resFLT').innerText);
    const tableMt = [...document.querySelectorAll('.val-mt')].map(e => e.value);
    const tableMc = [...document.querySelectorAll('.val-mc')].map(e => e.value);
    const tableLt = [...document.querySelectorAll('.val-lt')].map(e => e.value);

    let ssInitialI = parseFloat(document.getElementById('ssInitialI')?.value) || 250;
    let ssFinalI = parseFloat(document.getElementById('ssFinalI')?.value) || 300;
    let ssRampTime = parseFloat(document.getElementById('ssRampTime')?.value) || 1;
    
    let minStartResult = { current: 0, criticalSpeed: 0 };
    if (simulationMode === 'SS') {
        minStartResult = calculateMinStartingCurrent(tableMt, tableMc, tableLt);
        
        // Only warn if FINAL current is below minimum (initial can be low if ramping)
        const finalCurrent = Math.max(ssInitialI, ssFinalI);
        if (finalCurrent < minStartResult.current) {
            alert(`⚠️ INSUFFICIENT FINAL CURRENT\n\nYour final: ${finalCurrent}%\nMinimum: ${minStartResult.current}%\n\nMotor will likely STALL at ~${minStartResult.criticalSpeed}% speed.`);
        } else if (ssInitialI < minStartResult.current && ssRampTime > 0) {
            // Initial is low but final is OK — just inform user
            console.log(`ℹ️ Ramp starts below minimum (${ssInitialI}% < ${minStartResult.current}%) but ramps to sufficient current (${finalCurrent}%) — should work if ramp is fast enough.`);
        }
    }

    let results = runSimulationCore(simulationMode, ssInitialI, ssFinalI, ssRampTime, true);
    results.minStartResult = minStartResult;
    results.mFLC = mFLC;
    results.fltNm = fltNm;
    
    lastSimResults = results;
    displayResults(results);
    
    let lbls = Array.from({length: 501}, (_, i) => i * 0.2);
    let dolMt = [], dolMc = [], pLt = [], ssMt = [], ssMc = [];
    
    lbls.forEach(s => {
        let rm = interpolate(s, S_POINTS, tableMt);
        let rc = interpolate(s, S_POINTS, tableMc);
        let rl = interpolate(s, S_POINTS, tableLt);
        
        dolMt.push(rm);
        dolMc.push(rc);
        pLt.push(rl);
        
        if (simulationMode === 'SS') {
            let currentAtThisSpeed;
            if (ssRampTime > 0 && s <= results.rampEndSpeed && results.rampEndSpeed > 0) {
                currentAtThisSpeed = ssInitialI + (ssFinalI - ssInitialI) * (s / results.rampEndSpeed);
            } else {
                currentAtThisSpeed = ssFinalI;
            }
            let vr = Math.min(1, currentAtThisSpeed / rc);
            ssMt.push(rm * vr * vr);
            ssMc.push(currentAtThisSpeed);
        }
    });
    
    renderChart(lbls, dolMt, dolMc, ssMt, ssMc, pLt, results.stallSpd, minStartResult.criticalSpeed, mFLC, fltNm);
}

function displayResults(results) {
    const timeField = document.getElementById('resultTime');
    const mRPM = parseFloat(document.getElementById('mRPM').value);
    
    if (results.isStalled) {
        timeField.innerText = `STALL (${results.stallReason})`;
        timeField.contentEditable = 'false';
        timeField.style.background = 'rgba(244, 63, 94, 0.2)';
        timeField.style.color = '#f43f5e';
    } else {
        timeField.innerText = results.time.toFixed(2) + "s";
        timeField.contentEditable = simulationMode === 'SS' ? 'true' : 'false';
        timeField.style.cursor = simulationMode === 'SS' ? 'text' : 'default';
        timeField.style.background = '';
        timeField.style.color = '';
    }
    
    document.getElementById('resultTherm').innerText = thermalMode === 'absolute' ? 
        results.thermalAbs.toFixed(0) + " A²·s" : results.thermal.toFixed(1) + "%";
    
    const minNetAbs = (results.minNet * results.fltNm / 100).toFixed(1);
    document.getElementById('resultNet').innerText = 
        `${results.minNet.toFixed(1)}% (${minNetAbs} Nm) @ ${results.criticalNetSpeed.toFixed(0)}%spd`;
    
    if (simulationMode === 'SS') {
        const minStartAbs = (results.minStartResult.current * results.mFLC / 100).toFixed(1);
        document.getElementById('resultMinI').innerText = 
            `${results.minStartResult.current.toFixed(0)}% (${minStartAbs}A) @ ${results.minStartResult.criticalSpeed}%spd`;
    } else {
        document.getElementById('resultMinI').innerText = 'N/A (DOL mode)';
    }
    
    document.getElementById('resultFinalSlip').innerText = results.finalSlip.toFixed(3);
    
    // Calculate Operating Speed: ω_op = ω_rated × (1 - slip)
    const operatingRPM = mRPM * (1 - results.finalSlip);
    document.getElementById('resultOpSpeed').innerText = operatingRPM.toFixed(0) + " RPM";
}

function renderChart(labels, dolMt, dolMc, ssMt, ssMc, pLt, stallSpd, criticalSpeed, mFLC, fltNm) {
    const ctx = document.getElementById('mainChart');
    if (!ctx) return;
    if (chart) chart.destroy();
    
    const dolIsSolid = (simulationMode === 'DOL');
    const isMobile = window.innerWidth < 768;
    const isSmall = window.innerWidth < 480;
    
    // axesSwapped: false = Current on left (y), Torque on right (y1) — NEW DEFAULT
    //              true  = Torque on left (y), Current on right (y1)
    const torqueAxis = axesSwapped ? 'y' : 'y1';
    const currentAxis = axesSwapped ? 'y1' : 'y';
    const leftLabel  = axesSwapped ? 'Torque (%)' : 'Current (%)';
    const rightLabel = axesSwapped ? 'Current (%)' : 'Torque (%)';
    const leftPos = 'left', rightPos = 'right';
    
    let datasets = [
        { label: 'Motor Torque (DOL)', data: dolMt, borderColor: '#22d3ee', borderWidth: dolIsSolid ? 3 : 1, borderDash: dolIsSolid ? [] : [5, 5], pointRadius: 0, tension: 0, yAxisID: torqueAxis },
        { label: 'Load Torque', data: pLt, borderColor: '#f43f5e', borderDash: [5,5], borderWidth: 2, pointRadius: 0, tension: 0, yAxisID: torqueAxis },
        { label: 'Motor Current (DOL)', data: dolMc, borderColor: '#fbbf24', borderWidth: dolIsSolid ? 2 : 1, borderDash: dolIsSolid ? [] : [5, 5], yAxisID: currentAxis, pointRadius: 0, tension: 0 }
    ];
    
    if (simulationMode === 'SS') {
        datasets.push({ label: 'Motor Torque (SS)', data: ssMt, borderColor: '#10b981', borderWidth: 3, pointRadius: 0, tension: 0, yAxisID: torqueAxis });
        datasets.push({ label: 'Motor Current (SS)', data: ssMc, borderColor: '#f59e0b', borderWidth: 3, pointRadius: 0, tension: 0, yAxisID: currentAxis });
        
        if (criticalSpeed > 0) {
            const critIdx = Math.round(criticalSpeed / 0.2);
            datasets.push({
                label: 'Critical', data: [{x: criticalSpeed, y: ssMt[critIdx]}],
                pointStyle: 'triangle', pointRadius: 12, pointBackgroundColor: '#a855f7',
                pointBorderColor: '#fff', pointBorderWidth: 2, showLine: false, yAxisID: torqueAxis
            });
        }
    }
    
    if (stallSpd !== null) {
        const stallIdx = Math.round(stallSpd / 0.2);
        datasets.push({ 
            label: 'STALL', data: [{x: stallSpd, y: (simulationMode === 'SS' ? ssMt : dolMt)[stallIdx]}], 
            pointStyle: 'crossRot', pointRadius: 15, pointBackgroundColor: '#ff0000',
            pointBorderColor: '#fff', pointBorderWidth: 3, showLine: false, yAxisID: torqueAxis
        });
    }
    
    chart = new Chart(ctx, { 
        type: 'line', 
        data: { labels, datasets }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: { 
                x: {
                    title: {display: true, text: 'Motor Speed (%)', font: {size: 13, weight: 'bold'}, color: '#333'},
                    ticks: {
                        color: '#666',
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: isMobile ? 6 : 11,
                        font: {size: isSmall ? 9 : 10},
                        callback: function(value) {
                            const speedValue = this.getLabelForValue(value);
                            if (isMobile) {
                                return speedValue % 20 === 0 ? speedValue : '';
                            } else {
                                return speedValue % 10 === 0 ? speedValue : '';
                            }
                        }
                    },
                    grid: {color: 'rgba(0,0,0,0.08)'}
                }, 
                y: {
                    min: 0,
                    title: {display: true, text: leftLabel, font: {size: 13, weight: 'bold'}, color: '#333'},
                    ticks: {color: '#666', font: {size: 10}},
                    grid: {color: 'rgba(0,0,0,0.08)'},
                    position: 'left'
                }, 
                y1: {
                    position: 'right', 
                    min: 0,
                    title: {display: true, text: rightLabel, font: {size: 13, weight: 'bold'}, color: '#333'},
                    ticks: {color: '#666', font: {size: 10}},
                    grid: {drawOnChartArea: false}
                } 
            },
            plugins: {
                legend: {
                    display: true, 
                    position: 'top',
                    labels: {
                        color: '#333',
                        font: {size: isSmall ? 8 : (isMobile ? 9 : 10), weight: '600'},
                        boxWidth: isSmall ? 15 : 20,
                        padding: isSmall ? 4 : 6,
                        filter: (i) => !i.text.includes('Critical') && !i.text.includes('STALL')
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            let l = ctx.dataset.label || '';
                            if (l) l += ': ';
                            l += ctx.parsed.y.toFixed(1) + '%';
                            if (l.includes('Current')) l += ` (${(ctx.parsed.y * mFLC / 100).toFixed(1)}A)`;
                            else if (l.includes('Torque')) l += ` (${(ctx.parsed.y * fltNm / 100).toFixed(1)} Nm)`;
                            l += ` | Slip: ${(1 - ctx.parsed.x / 100).toFixed(3)}`;
                            return l;
                        }
                    }
                }
            }
        } 
    });
}

function solveForCurrentFromTime(targetTime) {
    const ssInitialI = parseFloat(document.getElementById('ssInitialI').value) || 300;
    const ssFinalI = parseFloat(document.getElementById('ssFinalI').value) || 300;
    const ssRampTime = parseFloat(document.getElementById('ssRampTime').value) || 0;
    
    // Case 1: No ramp (initial == final OR ramp time == 0)
    // Find a SINGLE current that gives target time, set both fields to it
    if (ssInitialI === ssFinalI || ssRampTime === 0) {
        let low = 200, high = 700, iterations = 0;
        let bestCurrent = 0, bestTime = 999;
        
        while (high - low > 5 && iterations < 25) {
            let mid = Math.floor((low + high) / 2);
            let result = runSimulationCore('SS', mid, mid, 0, true); // no ramp
            
            console.log(`[No Ramp] Iteration ${iterations}: ${mid}% → ${result.time.toFixed(2)}s (target: ${targetTime}s)`);
            
            if (result.isStalled) {
                low = mid + 1;
            } else if (result.time > targetTime) {
                low = mid + 1;
            } else {
                high = mid - 1;
                if (result.time < bestTime || bestCurrent === 0) {
                    bestCurrent = mid;
                    bestTime = result.time;
                }
            }
            iterations++;
        }
        
        if (bestCurrent === 0) {
            const tableMt = [...document.querySelectorAll('.val-mt')].map(e => e.value);
            const tableMc = [...document.querySelectorAll('.val-mc')].map(e => e.value);
            const tableLt = [...document.querySelectorAll('.val-lt')].map(e => e.value);
            const minResult = calculateMinStartingCurrent(tableMt, tableMc, tableLt);
            bestCurrent = minResult.current;
            alert(`⚠️ Could not find current for ${targetTime}s.\n\nUsing minimum: ${bestCurrent}%`);
        }
        
        // Set BOTH fields to the same value (no ramp)
        document.getElementById('ssInitialI').value = bestCurrent;
        document.getElementById('ssFinalI').value = bestCurrent;
        document.getElementById('ssRampTime').value = 0;
        console.log(`✓ Found single current: ${bestCurrent}% → ${bestTime.toFixed(2)}s`);
        
    } else {
        // Case 2: Ramping (initial != final AND ramp > 0)
        // Keep initial and ramp time fixed, find only the final current needed
        let low = Math.max(200, ssInitialI), high = 700, iterations = 0;
        let bestFinalCurrent = 0, bestTime = 999;
        
        while (high - low > 5 && iterations < 25) {
            let mid = Math.floor((low + high) / 2);
            let result = runSimulationCore('SS', ssInitialI, mid, ssRampTime, true);
            
            console.log(`[Ramp] Iteration ${iterations}: ${ssInitialI}%→${mid}% (${ssRampTime}s ramp) → ${result.time.toFixed(2)}s (target: ${targetTime}s)`);
            
            if (result.isStalled) {
                low = mid + 1;
            } else if (result.time > targetTime) {
                low = mid + 1;
            } else {
                high = mid - 1;
                if (result.time < bestTime || bestFinalCurrent === 0) {
                    bestFinalCurrent = mid;
                    bestTime = result.time;
                }
            }
            iterations++;
        }
        
        if (bestFinalCurrent === 0) {
            const tableMt = [...document.querySelectorAll('.val-mt')].map(e => e.value);
            const tableMc = [...document.querySelectorAll('.val-mc')].map(e => e.value);
            const tableLt = [...document.querySelectorAll('.val-lt')].map(e => e.value);
            const minResult = calculateMinStartingCurrent(tableMt, tableMc, tableLt);
            bestFinalCurrent = Math.max(minResult.current, ssInitialI + 50); // at least 50% above initial
            alert(`⚠️ Could not find final current for ${targetTime}s.\n\nTrying: ${bestFinalCurrent}%`);
        }
        
        // Update ONLY final current (initial and ramp stay as user set them)
        document.getElementById('ssFinalI').value = bestFinalCurrent;
        console.log(`✓ Found: ${ssInitialI}%→${bestFinalCurrent}% (${ssRampTime}s ramp) → ${bestTime.toFixed(2)}s`);
    }
    
    runSimulation();
}

function swapChartAxes() {
    axesSwapped = !axesSwapped;
    const btn = document.getElementById('btnSwapAxes');
    if (btn) {
        // false = Current LEFT (default), true = Torque LEFT (swapped)
        btn.textContent = axesSwapped ? '⇄ Restore I/T Axes' : '⇄ Swap I/T Axes';
        btn.style.background = axesSwapped ? 'rgba(34,211,238,.12)' : 'rgba(251,191,36,.12)';
        btn.style.borderColor = axesSwapped ? '#22d3ee' : '#fbbf24';
        btn.style.color = axesSwapped ? '#22d3ee' : '#fbbf24';
    }
    if (chart) runSimulation();
}

function showImportBanner(count) {
    const curveNames = ['Motor Torque', 'Motor Current', 'Load Torque'];
    const banner = document.createElement('div');
    banner.style.cssText = `
        position:fixed; top:80px; left:50%; transform:translateX(-50%);
        background:#0a0c10; border:2px solid var(--success); color:var(--success);
        padding:14px 28px; border-radius:10px; font-size:0.95rem; font-weight:700;
        z-index:999; font-family:'JetBrains Mono',monospace;
        box-shadow:0 4px 30px rgba(16,185,129,0.3);
    `;
    banner.innerHTML = `✅ Digitizer imported ${count} curve${count > 1 ? 's' : ''}! Run simulation to see results.`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 4000);
}

function exportToPDF() {
    const results = document.querySelector('.results');
    if (results) results.setAttribute('data-date', new Date().toLocaleString());
    window.print();
}

let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        if (lastSimResults && chart) runSimulation();
    }, 250);
});

function saveCase() {
    const name = document.getElementById('caseName').value;
    if(!name) return;
    const data = {
        config: {
            kw: document.getElementById('mKW').value, flc: document.getElementById('mFLC').value, 
            rpm: document.getElementById('mRPM').value, poles: document.getElementById('mPoles').value, 
            freq: document.getElementById('mFreq').value, motorJ: document.getElementById('motorJ').value, 
            loadJ: document.getElementById('loadJ').value, stall: document.getElementById('hStall').value, 
            ssInitialI: document.getElementById('ssInitialI').value, ssFinalI: document.getElementById('ssFinalI').value, 
            ssRampTime: document.getElementById('ssRampTime').value
        },
        table: {
            mt: [...document.querySelectorAll('.val-mt')].map(e => e.value), 
            mc: [...document.querySelectorAll('.val-mc')].map(e => e.value), 
            lt: [...document.querySelectorAll('.val-lt')].map(e => e.value)
        }
    };
    localStorage.setItem('case_' + name, JSON.stringify(data));
    loadCaseList();
    alert('Saved!');
}

function loadCaseList() {
    const dropdown = document.getElementById('caseDropdown');
    dropdown.innerHTML = '<option value="">-- Select Saved Case --</option>';
    Object.keys(localStorage).forEach(key => {
        if(key.startsWith('case_')) dropdown.innerHTML += `<option value="${key}">${key.replace('case_', '')}</option>`;
    });
}

function loadCase(e) {
    const data = JSON.parse(localStorage.getItem(e.target.value));
    if(!data) return;
    document.getElementById('mKW').value = data.config.kw;
    document.getElementById('mFLC').value = data.config.flc;
    document.getElementById('mRPM').value = data.config.rpm;
    document.getElementById('mPoles').value = data.config.poles || 4;
    document.getElementById('mFreq').value = data.config.freq || 50;
    document.getElementById('motorJ').value = data.config.motorJ || 0;
    document.getElementById('loadJ').value = data.config.loadJ || 0;
    document.getElementById('hStall').value = data.config.stall;
    if (data.config.ssInitialI) document.getElementById('ssInitialI').value = data.config.ssInitialI;
    if (data.config.ssFinalI) document.getElementById('ssFinalI').value = data.config.ssFinalI;
    if (data.config.ssRampTime) document.getElementById('ssRampTime').value = data.config.ssRampTime;
    const mts = document.querySelectorAll('.val-mt'), mcs = document.querySelectorAll('.val-mc'), lts = document.querySelectorAll('.val-lt');
    data.table.mt.forEach((v, i) => mts[i].value = v);
    data.table.mc.forEach((v, i) => mcs[i].value = v);
    data.table.lt.forEach((v, i) => lts[i].value = v);
    updateHeader();
    updateCombinedJ();
    window.splineCache = {};
}

function clearLibrary() {
    if(confirm("Wipe all saved cases?")) {
        Object.keys(localStorage).forEach(key => {
            if(key.startsWith('case_')) localStorage.removeItem(key);
        });
        loadCaseList();
    }
}

window.onload = init;
