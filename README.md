# Neuro-Aim: A web-based FPS aim trainer designed with specialized training modes.

## 🚀 How to Access

Simply visit the website to start training:
**[neuroaim.github.io](https://neuroaim.github.io)**

---

## 🎮 Gameplay Guide

### **Mode 01: Gabor Scout**
* **Goal:** A group of patterned patches will appear.
* **Action:** Find and click the specific target that has **vertical stripes**.

### **Mode 02: Pure Tracking**
* **Goal:** Follow the moving sphere with your crosshair.
* **Action:** Keep tracking until the progress is full .

### **Mode 03: No Crosshar Shooting**
* **Goal:** Hit targets appearing randomly on the screen.
* **Action:** There is **no crosshair** in this mode. You must rely on your sense to aim and click the targets.

### **Mode 04: Landolt Saccade**
* **Goal:** A "C" shaped ring (Landolt C) will appear in your peripheral vision.
* **Action:** First quickly identify the direction of the gap (Up, Down, Left, or Right), and flick your aim to the target, then press the corresponding key (**W/A/S/D**).

### **Mode 05: Parafoveal Ghost**
* **Goal:** Keep your crosshair tracking the central **Blue Ring**.
* **Action:**
    * **Blue Ghost:** When a blue target appears in the periphery, flick to click it, then immediately return to tracking the center.
    * **Red Ghost:** Ignore it. Do not click.

### **Mode 06: Memory Sequencer**
* **Goal:** Memorize the positions of targets.
* **Action:**
    1.  Watch the targets appear in sequence (1, 2, 3...).
    2.  Wait during the blank phase.
    3.  Click the center **"SHOOT"** orb when it appears.
    4.  Click the original locations of the targets in the correct order.

### **Mode 07: Cognitive Switch**
* **Goal:** Shoot targets based on the current rule.
* **Action:** Read the HUD instruction at the bottom:
    * **"SHOOT GREEN"**: Only click green spheres.
    * **"SHOOT RED"**: Only click red spheres.
    * *Note: The rule will switch periodically.*

### **Mode 08: Horizontal Tracking**

* **Goal:** Follow the vertical bar moving left and right with your crosshair.
* **Action:** Keep tracking to accumulate progress. The target is automatically eliminated when the progress bar is full.

---

## ⚡ Strobe Training (Advanced, super useful for Mode 2 and 8)

> **⚠️ SAFETY WARNING**
> **Do NOT use this feature if you have a family history of photosensitive epilepsy or sensitivity to flashing lights.**
> If you experience dizziness, blurred vision, eye twitching, or disorientation, **STOP IMMEDIATELY**.

Strobe training occludes vision intermittently to force the brain to predict target movement.

### **1. In-Game Strobe**
* Go to **SETTINGS** -> **STROBE TRAINING**.
* Toggle the checkbox for specific modes (M1 - M7) to enable the effect within that mode.

### **2. External Tool (Strobe.exe)**
For a global effect that works over any application, use the standalone `Strobe.exe`.

* **Requirement:** Your game or Aim Trainer must be in **Borderless Window** or **Windowed** mode (not Exclusive Fullscreen) for the overlay to be visible.
* **How to Use:**
    1.  Download Strobe.exe and run it.
    2.  Press **F9** or click **START** to toggle the strobe effect on/off.
    3.  Adjust **Frequency (Hz)** (flashes per second) and **Duty Cycle (%)** (visibility duration) via the control panel sliders.
    4.  The overlay is click-through and will not interfere with your mouse input.