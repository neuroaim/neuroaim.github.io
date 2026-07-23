# Neuro-Aim: A web-based FPS aim trainer designed with specialized training modes.

## Local run

Run `npx http-server -p 8080` in this directory and open
`http://localhost:8080`. The WebGL range ships with a local Three.js r185 build,
so no build step or external 3D asset host is needed. Mode 4 is **Target Lock**:
left click identifies a left-facing head gap; right click identifies a right-facing gap.

## View and mouse calibration

The 3D camera uses Counter-Strike's Hor+ standard: 90° horizontal at 4:3,
which is 106.26° horizontal / 73.74° vertical at 16:9. The settings panel
accepts hip-fire sensitivity values for Counter-Strike 2, Valorant, modern
Call of Duty / Warzone, Overwatch 2, Marvel Rivals, Apex Legends, and Rainbow
Six Siege with its default `MouseSensitivityMultiplierUnit=0.02`. Switching the
game profile converts the displayed number while preserving the same physical
360° turn. ADS and zoom multipliers remain game-specific and are not applied.

## Per-mode physical range layout

Every mode rebuilds the clear shooting lane around its own training purpose.
The target's calibrated angular size and hit tolerance remain unchanged; the
floor perspective, lighting, backstop, and physical target plane use the real
distances below. There are no close booth dividers or cross-lane rails.

| Mode | Target plane | Backstop | Room width |
| --- | ---: | ---: | ---: |
| 1 — Gabor Scout | 12 m | 13.5 m | 16 m |
| 2 — Pure Tracking | 15 m | 20 m | 24 m |
| 3 — No Crosshair Shooting | 13.4–13.7 m (wall-mounted) | 14 m | 20 m |
| 4 — Target Lock | 14 m | 19 m | 42–50 m* |
| 5 — Peripheral Pop | 11 m | 16 m | 20 m |
| 6 — Cognitive Switch | 13 m | 18 m | 22 m |
| 7 — Horizontal Tracking | 10.5–21 m | 22 m | 26 m |

\* Target Lock is wider because its dynamic peripheral drill places enemies in
all eight peripheral screen regions. Width adapts to the viewport; depth stays
compact.

## 🚀 How to Access

Simply visit the website to start training:
**[neuroaim.github.io](https://neuroaim.github.io)**

---

## 🎮 Gameplay Guide

### **Mode 01: Gabor Scout**
* **Goal:** A group of patterned training balls appears downrange.
* **Action:** Find and click the ball with **vertical stripes**.

### **Mode 02: Pure Tracking**
* **Goal:** Follow the moving sphere with your crosshair.
* **Action:** Keep tracking while the completed area spreads from the sphere's center across its surface.

### **Mode 03: No Crosshar Shooting**
* **Goal:** Hit targets appearing randomly on the screen.
* **Action:** There is **no crosshair** in this mode. You must rely on your sense to aim and click the targets.

### **Mode 04: Target Lock**
* **Goal:** Fixate the flashing center dot, then acquire the head of a fixed-size procedural target in one of eight balanced peripheral zones.
* **Action:** After the probe/noise sequence, use **left click** for a left-facing gap and **right click** for a right-facing gap. The 60-second drill adapts symbol delay, duration, and distractor complexity; response speed is not scored.

### **Mode 05: Peripheral Pop**
* **Goal:** Acquire and click each ball before it disappears.
* **Action:** One ball appears at a time inside a fixed 30° total circular acquisition cone around the range center. A hit succeeds; a missed click or expired ball fails. Higher difficulty reduces both target size and lifetime.

### **Mode 06: Cognitive Switch**
* **Goal:** Shoot targets based on the current rule.
* **Action:** Read the HUD instruction at the bottom:
    * **"SHOOT GREEN"**: Only click green spheres.
    * **"SHOOT RED"**: Only click red spheres.
    * *Note: The rule will switch periodically.*

### **Mode 07: Horizontal Tracking**

* **Goal:** Follow a near, middle, or far moving training dummy with your crosshair.
* **Action:** Keep tracking to accumulate progress. The dummy brightens from its own material and is automatically eliminated at full progress.

---

## ⚡ Strobe Training (Advanced, super useful for Mode 2 and 7)

> **⚠️ SAFETY WARNING**
> **Do NOT use this feature if you have a family history of photosensitive epilepsy or sensitivity to flashing lights.**
> If you experience dizziness, blurred vision, eye twitching, or disorientation, **STOP IMMEDIATELY**.

Strobe training occludes vision intermittently to force the brain to predict target movement.

### **1. In-Game Strobe**
* Go to **SETTINGS** -> **STROBE TRAINING**.
* Toggle the checkbox for supported modes. Target Lock (M4) uses its own dynamic visual protocol and never enables strobe.

### **2. External Tool (Strobe.exe)**
For a global effect that works over any application, use the standalone `Strobe.exe`.

* **Requirement:** Your game or Aim Trainer must be in **Borderless Window** or **Windowed** mode (not Exclusive Fullscreen) for the overlay to be visible.
* **How to Use:**
    1.  Download Strobe.exe and run it.
    2.  Press **F9** or click **START** to toggle the strobe effect on/off.
    3.  Adjust **Frequency (Hz)** (flashes per second) and **Duty Cycle (%)** (visibility duration) via the control panel sliders.
    4.  The overlay is click-through and will not interfere with your mouse input.
