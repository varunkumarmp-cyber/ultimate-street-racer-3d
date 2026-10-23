# 🏎️ ULTIMATE STREET RACER - 3D Racing Game

**Ultimate Street Racer** is a complete, fully playable 3D arcade car racing game built with Three.js and the Web Audio API. It is engineered specifically for web game engines, standalone browsers, and the **Rosebud AI** game environment.

---

## 🌟 Key Features

### 1. 🏁 3D Graphics & Game World
- **Smooth Chase Camera**: Dynamic third-person chase camera with 4 switchable views (`C` key: Close Chase, Far Chase, Hood/Bumper, Helicopter/Birds-eye), speed-based dynamic FOV punch, and trauma-based collision camera shake.
- **Detailed 3D Sports Cars**: Procedural 3D car geometry with aerodynamic cockpits, spoilers, diffusers, front splitters, glowing headlights, dynamic brake lights, dual exhaust pipes, and 4 wheels with rotating rubber tires, alloy rims, and red brake calipers.
- **3 Unique Racing Circuits**:
  1. **Neon City Circuit**: Night urban streets surrounded by 90+ skyscrapers, glowing neon signs, grandstands, illuminated bridges, and tight chicanes.
  2. **Alpine Mountain Pass**: Mountain switchbacks with rolling hills, elevation changes, rock cliffs, and 110+ pine trees.
  3. **Desert Canyon Speedway**: High-speed sweeping tri-oval canyon course surrounded by towering sandstone mesas and saguaro cacti.
- **Curbs & Guardrails**: Asphalt road with dashed centerlines, alternating red/white rumble strips, and crash barriers with yellow/black hazard chevrons.

### 2. 🎮 Controls & Input
- **Keyboard Controls**:
  - `W` / `↑ (Arrow Up)`: Accelerate
  - `S` / `↓ (Arrow Down)`: Brake / Reverse
  - `A` / `← (Arrow Left)`: Steer Left
  - `D` / `→ (Arrow Right)`: Steer Right
  - `SPACE`: Handbrake / Drift
  - `SHIFT`: Nitro Boost
  - `C`: Switch Camera View
  - `R`: Reset Car to Track
  - `ESC`: Pause / Resume Race
- **Mobile Touch Overlay**: Ergonomic on-screen virtual controls for Steering (`◀` / `▶`), Gas pedal, Brake pedal, Handbrake (Drift), Nitro boost, Camera view, and Pause.

### 3. ⚙️ Vehicle Dynamics & Drift Physics
- **Realistic Acceleration & Braking**: Speed-dependent torque curves with 6-speed transmission and reverse gear.
- **Speed-Dependent Steering**: Steering sensitivity dynamically adapts to vehicle speed, offering crisp low-speed cornering and high-speed stability.
- **Drift Slip Mechanics**: Engaging the handbrake reduces lateral friction and initiates rear-wheel drift slip with counter-steering control, accompanied by tire screeching audio and tire smoke particles.
- **Nitro Boost**: Temporarily boosts acceleration and top speed by up to 55%, accompanied by blue flame particles from twin exhausts, whoosh audio, and screen rush effects. Gradually recharges when cruising and charges faster during active drifts!
- **Off-Road Deceleration**: Leaving the asphalt road triggers rolling resistance penalties and kicks up dirt/dust particles.
- **Barrier & Vehicle Collisions**: Elastic collision impulses between cars and barriers, complete with spark particle bursts, metal impact sound effects, and momentum transfers.
- **Ground Clamping**: Vehicles stay glued to the 3D track surface and never clip or fall through the terrain.

### 4. 🤖 AI Racing Opponents
- **5 Autonomous AI Drivers**:
  1. *Ghost Vance* (Phantom R - Cyan, aggressive overtaker)
  2. *Fury Rostova* (Viper V8 - Gold/Black, late braker)
  3. *Kenji Sato* (Apex GT - Emerald, smooth racing lines)
  4. *Jax Cole* (Viper V8 - Orange, defensive competitor)
  5. *Nova Chen* (Apex GT - Purple, balanced contender)
- **Intelligent Driving**: AI predicts upcoming corner curvature to brake appropriately, shifts lanes to overtake or draft, avoids rear-ending cars, and features balanced rubber-banding to keep every race intense.
- **Dynamic Leaderboard**: Real-time position tracking (1st to 6th) calculated frame-by-frame based on total race progress.

### 5. 🔊 Procedural Web Audio Engine (Zero External Audio Files)
- **Engine Synthesizer**: Dual-oscillator engine roar modulating in real-time with RPM, gear ratio, and throttle load.
- **Tire Screech**: Bandpass-filtered white noise reacting to drift slip velocity.
- **Nitro Whoosh**: Jet rocket exhaust roar with pitch bend and resonance.
- **Collision Impacts**: Punchy low-end thumps with metallic noise bursts.
- **Race Audio Cues**: Low countdown beeps (3, 2, 1), high GO! chime, checkpoint bell chimes, and victory fanfare.
- **Dynamic Synthwave Background Music**: Built-in 16-step procedural music sequencer featuring kick drum, snare, hi-hat, 80s synth bassline, and lead arpeggios.

### 6. 📱 Menus & UI
- **Arcade HUD**: Analog tachometer with moving needle, digital speedometer in km/h, gear indicator (`1-6`, `R`, `N`), lap counter (`LAP 1/3`), position badge (`1ST / 6`), race timer, best lap tracker, glowing nitro bar, wrong-way alert badge, and interactive 2D track minimap.
- **Main Menu**: 3D turntable car showcase camera, Play Race, Car Select, Track Select, and Settings.
- **Car Select Screen**: Compare stats (Top Speed, Accel, Handling, Drift Grip) across 3 distinct machines: *Apex GT*, *Viper V8*, and *Phantom R*.
- **Track Select Screen**: Choose between *Neon City*, *Alpine Pass*, and *Desert Canyon*.
- **Settings Screen**: Sliders for Master Volume, Synthwave Music, Sound FX, and Touch Controls toggle.
- **Race Results Screen**: Final position, total race time, best lap, and full leaderboard table.

---

## 🚀 Running the Game

### Option A: In Rosebud AI
1. In Rosebud AI, open your project workspace.
2. If uploading files:
   - Upload `index.html`, `css/style.css`, `js/`, and `lib/three.min.js`.
3. If pasting single-file code:
   - Open `standalone.html` and copy its entire content directly into Rosebud AI's main code editor. Everything (HTML, CSS, JavaScript, procedural models, Web Audio synthesizer, and particles) is bundled self-contained into that single file!
4. Click **Play** / **Run** in Rosebud AI to start racing!

### Option B: Running Locally (Any Browser)
You can simply open `index.html` or `standalone.html` in any modern web browser (Chrome, Edge, Firefox, Safari).

Alternatively, serve with Python:
```bash
python -m http.server 8080
```
Then visit: `http://localhost:8080`

---

## 📁 Project Directory Structure
```
ultimate-street-racer/
├── index.html              # Main HTML5 entry point with CDN & local library fallback
├── standalone.html         # Single-file bundled edition for Rosebud AI / embedded play
├── build_standalone.js     # Node script to compile standalone.html
├── README.md               # Game documentation and controls guide
├── css/
│   └── style.css           # Glassmorphic HUD, neon styling, speedometer, touch controls
├── js/
│   ├── audio.js            # Web Audio API engine synthesizer, SFX, & synthwave music
│   ├── particles.js        # High-performance particle pools (smoke, nitro, sparks, dust)
│   ├── car.js              # Procedural 3D car builder, rotating wheels, steering, brake lights
│   ├── track.js            # Catmull-Rom 3D track ribbon, curbs, barriers, checkpoints, scenery
│   ├── physics.js          # Vehicle dynamics, drift slip, off-road drag, barrier collision
│   ├── ai.js               # 5 AI racing opponents with lane shifting and car-to-car collision
│   ├── ui.js               # HUD manager, 2D canvas minimap, countdown, results, pause
│   └── game.js             # Master game loop, Three.js scene, 4-mode chase camera, state machine
└── lib/
    └── three.min.js        # Offline local copy of Three.js r128
```
