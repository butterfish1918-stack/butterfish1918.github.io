/**
 * INTAKE v3.0
 * "Clinical Brutalist" Web Protocol
 * Author: Curtis Orion / Gemini
 */

// --- DATA STRUCTURES ---

const CATEGORIES = {
    "SEDATIVES": "A. The Sedatives (Down-Regulation)",
    "STIMULANTS": "B. The Stimulants (Up-Regulation)",
    "PSYCHONAUTICS": "C. The Psychonautics (Altered States)",
    "RESILIENCE": "D. The Resilience (Training)",
    "MAINTENANCE": "E. The Maintenance (Daily Hygiene)"
};

const PROTOCOLS = [
    { id: "CRASH", cat: "SEDATIVES", name: "The Crash", desc: "Heavy Drip. Pitch Drop.", in: 4, holdIn: 0, out: 8, holdOut: 0, color: "#2F4F4F", physics: "HEAVY_DRIP", audio: "PITCH_DROP", meta: "1:2 Ratio | Viscosity" },
    { id: "COMA", cat: "SEDATIVES", name: "The Coma", desc: "Crystallisation. Brown Noise.", in: 4, holdIn: 7, out: 8, holdOut: 0, color: "#3B2F2F", physics: "CRYSTAL", audio: "BROWN_NOISE", meta: "4-7-8 | Freeze" },
    { id: "ANESTHETIC", cat: "SEDATIVES", name: "The Anesthetic", desc: "Ghost Trail. Isochronic.", in: 5, holdIn: 0, out: 5, holdOut: 0, loop: true, color: "#4B0082", physics: "GHOST_TRAIL", audio: "ISOCHRONIC", meta: "0.1 Hz Loop | Dissociation" },
    { id: "PANIC_ROOM", cat: "SEDATIVES", name: "The Panic Room", desc: "Starburst. Static Burst.", in: 1.5, holdIn: 0, out: 6, holdOut: 0, color: "#FF0000", physics: "STARBURST", audio: "STATIC_BURST", meta: "Double Tap | Reset" },
    { id: "HIBERNATION", cat: "SEDATIVES", name: "The Hibernation", desc: "Tidal Pool. Cabin Pressure.", in: 5, holdIn: 5, out: 10, holdOut: 5, color: "#708090", physics: "TIDAL", audio: "CABIN_PRESSURE", meta: "Box Extended | Slow" },
    { id: "DETOX", cat: "SEDATIVES", name: "The Detox", desc: "The Scrubber. High-Freq Clarity.", in: 4, holdIn: 0, out: 2, holdOut: 0, color: "#E0FFFF", physics: "SCRUBBER", audio: "CLARITY", meta: "Fast | Oxygenation" },

    { id: "ADRENALINE", cat: "STIMULANTS", name: "The Adrenaline", desc: "Ferrofluid Spikes. Sawtooth.", in: 1, holdIn: 0, out: 1, holdOut: 0, color: "#00FFFF", physics: "SPIKES", audio: "SAWTOOTH", meta: "Tummo | Aggression" },
    { id: "SNIPER", cat: "STIMULANTS", name: "The Sniper", desc: "The Box. Metronome.", in: 4, holdIn: 4, out: 4, holdOut: 4, color: "#FFFFFF", physics: "BOX_ROTATION", audio: "METRONOME", meta: "Square | Precision" },
    { id: "SPRINTER", cat: "STIMULANTS", name: "The Sprinter", desc: "The Strobe. Industrial Percussion.", in: 0.5, holdIn: 0, out: 0.5, holdOut: 0, color: "#FFD700", physics: "STROBE", audio: "KICK_DRUM", meta: "140 BPM | Gamma" },
    { id: "COLD_SHOWER", cat: "STIMULANTS", name: "The Cold Shower", desc: "Shattering. Metallic Impact.", in: 1, holdIn: 1, out: 1, holdOut: 0, color: "#00BFFF", physics: "SHATTER", audio: "METALLIC", meta: "Sharp | Alertness" },
    { id: "WRITER", cat: "STIMULANTS", name: "The Writer", desc: "The Vortex. Stereo Panning.", in: 2.5, holdIn: 0, out: 2.5, holdOut: 0, color: "#FF69B4", physics: "VORTEX", audio: "PANNING_PINK", meta: "Circular | Alpha" },
    { id: "LOGIC_GATE", cat: "STIMULANTS", name: "The Logic Gate", desc: "Digital Rain. Telemetry.", in: 4, holdIn: 2, out: 4, holdOut: 0, color: "#00FF00", physics: "MATRIX", audio: "TELEMETRY", meta: "Matrix | Computing" },

    { id: "VOID", cat: "PSYCHONAUTICS", name: "The Void", desc: "Null State. Digital Silence.", in: 15, holdIn: 15, out: 15, holdOut: 15, color: "#000000", physics: "NULL", audio: "SILENCE", meta: "Blackout | Deprivation" },
    { id: "TIME_DILATOR", cat: "PSYCHONAUTICS", name: "The Time Dilator", desc: "Elasticity. Shepard Tone.", in: 10, holdIn: 0, out: 10, holdOut: 0, color: "#800080", physics: "ELASTIC", audio: "SHEPARD", meta: "Slow Motion | Distortion" },
    { id: "DREAMER", cat: "PSYCHONAUTICS", name: "The Dreamer", desc: "The Glitch. Binaural Whispers.", in: 2.5, holdIn: 0, out: 2.5, holdOut: 0, color: "#FF4500", physics: "GLITCH", audio: "BINAURAL_WHISPER", meta: "Theta | Lucid" },
    { id: "OUT_OF_BODY", cat: "PSYCHONAUTICS", name: "The Out-of-Body", desc: "Z-Axis Zoom. Phasing.", in: 6, holdIn: 0, out: 6, holdOut: 0, color: "#888888", physics: "ZOOM", audio: "PHASING", meta: "Tunnel | Separation" },
    { id: "TANTRA", cat: "PSYCHONAUTICS", name: "The Tantra", desc: "The Pulse. The Drone.", in: 6, holdIn: 3, out: 6, holdOut: 0, color: "#8B0000", physics: "PULSE_MASS", audio: "DRONE_LOW", meta: "Heart | Energy" },
    { id: "GHOST", cat: "PSYCHONAUTICS", name: "The Ghost", desc: "Flicker. Infrasound.", in: 5, holdIn: 2, out: 5, holdOut: 2, color: "#F0F8FF", physics: "FLICKER", audio: "INFRASOUND", meta: "18 Hz | Uneasiness" },

    { id: "DIVER", cat: "RESILIENCE", name: "The Diver", desc: "Data Only. Sonar.", in: 0, holdIn: 0, out: 0, holdOut: 0, color: "#FFFFFF", physics: "DATA_ONLY", audio: "SONAR", meta: "Apnea | CO2" },
    { id: "ASTRONAUT", cat: "RESILIENCE", name: "The Astronaut", desc: "Claustrophobia. Vacuum Seal.", in: 4, holdIn: 0, out: 10, holdOut: 5, color: "#800000", physics: "CLAUSTRO", audio: "VACUUM", meta: "Mask | Hypoxia" },
    { id: "STOIC", cat: "RESILIENCE", name: "The Stoic", desc: "The Monolith. Dead Air.", in: 4, holdIn: 0, out: 4, holdOut: 15, color: "#778899", physics: "MONOLITH", audio: "SILENCE", meta: "Solid | Control" },
    { id: "MONK", cat: "RESILIENCE", name: "The Monk", desc: "Embers. Roar.", in: 1, holdIn: 0, out: 1, holdOut: 0, color: "#FFA500", physics: "EMBERS", audio: "ROAR", meta: "Rising | Heat" },

    { id: "COHERENCE", cat: "MAINTENANCE", name: "The Coherence", desc: "Laminar Sine. Warm Pad.", in: 5.5, holdIn: 0, out: 5.5, holdOut: 0, color: "#FFBF00", physics: "LAMINAR", audio: "WARM_PAD", meta: "Sphere | HRV" },
    { id: "VOCALIST", cat: "MAINTENANCE", name: "The Vocalist", desc: "Resonance. The Hiss.", in: 4, holdIn: 0, out: 12, holdOut: 0, color: "#98FB98", physics: "RESONANCE", audio: "HISS", meta: "Vibration | Voice" },
    { id: "DIGESTIVE", cat: "MAINTENANCE", name: "The Digestive", desc: "Churning. The Purr.", in: 4, holdIn: 0, out: 6, holdOut: 2, color: "#228B22", physics: "CHURN", audio: "PURR", meta: "Turbulence | Digestion" }
];
