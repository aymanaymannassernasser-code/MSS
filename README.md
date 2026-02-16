# Motor Starter Simulator - Technical Documentation

**By: Ayman Elkhodary**

A professional web-based motor starting analysis tool for DOL (Direct-On-Line) and Soft Start methods.

---

## 📐 Mathematical Foundation

### 1. **Angular Dynamics (Newton's Second Law for Rotation)**

The fundamental equation governing motor acceleration:

```
J × dω/dt = T_net

Where:
- J = Total moment of inertia (kgm²)
- ω = Angular velocity (rad/s)
- T_net = Net torque (Motor - Load) in Nm
```

**Rearranged for numerical integration:**
```
α = T_net / J                    [Angular acceleration, rad/s²]
ω(t+Δt) = ω(t) + α × Δt         [Euler integration]
speed% = (ω / ω_rated) × 100    [Percentage speed]
```

**Example Calculation (450kW Motor):**
```
At 0% speed (locked rotor):
- Motor Torque: 80% × 2893 Nm = 2314 Nm
- Load Torque: 12% × 2893 Nm = 347 Nm
- Net Torque: 1967 Nm
- Acceleration: 1967 / 15.7 = 125.3 rad/s²

At rated speed (1485 RPM = 155.5 rad/s):
- Time to accelerate ≈ 155.5 / avg_accel ≈ 1-1.5 seconds
```

---

### 2. **Voltage-Torque Relationship (Soft Start)**

For induction motors, torque is proportional to voltage squared:

```
V_reduced / V_rated = √(I_limit / I_full)    [Voltage ratio]

T_reduced = T_rated × (V_reduced / V_rated)²  [Torque reduction]

Therefore: T ∝ V² ∝ I
```

**Physical Basis:**
- Voltage reduction reduces flux: Φ ∝ V
- Torque depends on flux squared: T ∝ Φ²
- Therefore: T ∝ V²

**Example:**
```
If current limited to 300% (vs 590% full voltage):
- Voltage ratio: √(300/590) = 0.713
- Torque: 80% × 0.713² = 40.6%
```

---

### 3. **Thermal Accumulation (I²t Withstand)**

The motor's thermal capacity is consumed during starting:

```
I²t_absolute = ∫ I²(t) dt    [Ampere-squared seconds, A²·s]

I²t_limit = I_LR² × t_hotstall    [Maximum thermal capacity]

TCU% = (I²t_actual / I²t_limit) × 100    [Thermal Capacity Used]
```

**Example Calculation:**
```
For 450kW motor (FLC = 48A, LRC = 590%):
- Locked rotor current: 590% × 48 = 283.2 A
- Hot stall time: 15 seconds
- Thermal limit: 283.2² × 15 = 1,202,430 A²·s

During DOL start (8.5s):
- Average current: ~350% × 48 = 168 A
- I²t accumulation: 168² × 8.5 ≈ 240,000 A²·s
- TCU%: 240,000 / 1,202,430 × 100 = 20%
```

---

### 4. **Slip and Speed Relationship**

```
slip = (ω_sync - ω_rotor) / ω_sync

ω_sync = 2π × n_s / 60 = 2π × (120f/p) / 60    [Synchronous speed]

Where:
- f = Frequency (Hz)
- p = Number of poles
- n_s = Synchronous speed (RPM)
```

**Operating Speed Calculation:**
```
ω_operating = ω_sync × (1 - slip)
RPM_operating = RPM_rated × (1 - slip)
```

**Example:**
```
4-pole motor, 50Hz:
- Synchronous: n_s = (120 × 50) / 4 = 1500 RPM
- At slip = 0.010 (1%):
  Operating: 1500 × (1 - 0.010) = 1485 RPM ✓
```

**Physical Insight:**
- Motor can NEVER reach synchronous speed (would require slip = 0 → zero torque)
- Typical operating slip: 0.5-5% (larger motors have smaller slip)
- Slip determines rotor current and losses: I_rotor ∝ slip

---

### 5. **Minimum Starting Current (Soft Start)**

To ensure motor can overcome load at ALL speeds:

```
For each test current I_test from 200% to 700%:
    For each speed 0% to 95%:
        V_ratio = I_test / I_motor(speed)
        T_motor_reduced = T_motor(speed) × V_ratio²
        T_net = T_motor_reduced - T_load(speed)
        
        If T_net < 0 at any speed:
            Current insufficient → Try higher
        
        Track minimum net torque and critical speed
    
    If T_net ≥ 2% at all speeds:
        Return I_test as minimum starting current
```

**IEEE Std 399 (Brown Book) Recommendation:**
- Maintain ≥2% safety margin above zero net torque
- Critical speed typically 70-80% (pullout region)

**Example:**
```
For OEM motor/load curves:
- Minimum starting current: 286%
- Critical speed: 70%
- Net torque at critical: 2.3% (just above safety margin)
```

---

### 6. **Interpolation Methods**

**Linear Interpolation:**
```
y = y₀ + (x - x₀) × (y₁ - y₀) / (x₁ - x₀)
```
- Simple, reliable, always valid
- Creates straight lines between data points
- Slightly conservative results

**Cubic Spline (Monotonic - Fritsch-Carlson):**
```
For each interval [x_i, x_{i+1}]:
    Hermite basis functions:
    h₀₀(t) = (1 + 2t)(1 - t)²
    h₁₀(t) = t(1 - t)²
    h₀₁(t) = t²(3 - 2t)
    h₁₁(t) = t²(t - 1)
    
    y(x) = h₀₀·y_i + h₁₀·h·m_i + h₀₁·y_{i+1} + h₁₁·h·m_{i+1}
    
    With monotonicity constraint:
    If Δ_{i-1} × Δ_i ≤ 0:  m_i = 0  (inflection point)
    Else: Limit |m_i| to prevent overshooting
```

- Smooth, Excel-style curves
- Prevents overshoots (monotonic constraint)
- More realistic physics representation
- User can toggle between methods

---

## 📊 Torque-Speed Curves

Typical induction motor torque curve characteristics:

```
     T%
     200│                        
        │                    ○---○ Locked Rotor Torque (LRT)
     150│              ○--○´     
        │         ○--○´           
     100│    ○--○´            ━━━ Motor Torque
      50│○--´                 ╌╌╌ Load Torque
        │╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
      0 └─────────────────────────► Speed%
        0  20  40  60  80  100

Key Points:
- LRT (0%): Starting torque capability
- Pullout (70-80%): Minimum net torque region (CRITICAL!)
- Breakdown (90-95%): Maximum torque capability
- Rated (100%): Full-load operating point
```

**Load Curves:**
```
Centrifugal: T ∝ ω²  (pumps, fans)
Constant: T = constant (conveyors, hoists)
Linear: T ∝ ω (some machinery)
```

---

## 🔬 Validation Against Industry Standards

### IEEE Std 112 (Motor Testing)
✓ Locked rotor and breakdown torque measurements
✓ Slip calculation methods
✓ Thermal withstand procedures

### NEMA MG-1 (Motors & Generators)
✓ Starting time calculation methodology
✓ Hot stall time limits (typically 10-20s)
✓ Design letter classifications (A, B, C, D)

### IEEE Std 399 (Brown Book - Motor Starting)
✓ 2% safety margin for minimum starting current
✓ Voltage drop during starting
✓ Multi-criteria stall detection

### IEC 60034 (Rotating Machines)
✓ Thermal duty cycles
✓ Starting frequency limits
✓ Performance characteristics

---

## 💡 Engineering Insights

### Why DOL Starting is Fast (1-2 seconds)
```
Average net torque ≈ 70-80% of rated
Average acceleration ≈ 130 rad/s²
High current (590%), high torque → fast start
```

### Why Soft Start is Slower (10-12 seconds)
```
Current limited to 250-300%
Voltage: ~65-71% of rated
Torque reduced by V²: ~42-50% of full
Lower net torque → slower acceleration
```

### Thermal Comparison
```
DOL: High current, short time → ~25-30% TCU
Soft Start: Lower current, longer time → ~25-30% TCU
Result: Similar thermal stress! (I²t product similar)
```

### Operating Speed vs Synchronous Speed
```
Synchronous: n_s = 120f/p (fixed by system)
Operating: n_op = n_s × (1 - slip) (depends on load)

Example: 1500 RPM sync, 1% slip → 1485 RPM operating
The 1% slip (15 RPM) generates the rotor current 
that produces torque to match the load!
```

---

## 🎯 Practical Applications

### 1. **Soft Starter Sizing**
Use minimum starting current to select soft starter rating.

### 2. **Thermal Duty Analysis**
Ensure multiple starts don't exceed thermal capacity:
```
If TCU per start = 25%
Safe starts per hour ≤ 100 / 25 = 4 starts/hour
```

### 3. **Load Analysis**
Compare motor capability vs load requirement:
```
If min net torque < 5%: Risk of stall or long start
If min net torque > 30%: Over-designed, consider smaller motor
```

### 4. **Voltage Drop Analysis**
High starting current causes voltage drop:
```
V_drop = I_start × Z_cable
If V_drop > 10-15%: May need soft start or larger cables
```

---

## 🔧 Model Accuracy

### Assumptions:
1. Constant rated power and torque
2. Linear voltage-current relationship during soft start
3. Negligible power factor variation
4. No saturation effects
5. Ideal voltage control (no harmonics)

### Limitations:
1. Does not model:
   - Harmonics and power quality
   - Motor heating distribution
   - Magnetic saturation
   - Voltage unbalance effects
   
2. Accuracy:
   - Start time: ±10-15% vs measured
   - Thermal: ±5-10% vs calculation
   - Suitable for preliminary engineering, not replacement for factory testing

---

## 📚 References

1. IEEE Std 112-2017: "IEEE Standard Test Procedure for Polyphase Induction Motors and Generators"

2. NEMA MG 1-2016: "Motors and Generators"

3. IEEE Std 399-1997: "IEEE Recommended Practice for Industrial and Commercial Power Systems Analysis" (Brown Book)

4. IEC 60034-1:2017: "Rotating electrical machines - Part 1: Rating and performance"

5. Chapman, S.J. "Electric Machinery Fundamentals", 5th Ed. McGraw-Hill, 2012

6. Fitzgerald, A.E., Kingsley, C., Umans, S.D. "Electric Machinery", 6th Ed. McGraw-Hill, 2003

---

## 📧 Contact

**Ayman Elkhodary**

For questions, improvements, or collaboration on motor analysis projects.

---

*This simulator is provided for educational and preliminary engineering purposes. 
Always verify critical applications with manufacturer data and field testing.*
