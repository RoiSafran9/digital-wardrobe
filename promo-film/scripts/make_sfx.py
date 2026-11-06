"""Synthesize the film's original micro-sounds into public/sfx/ (48 kHz mono WAV). No samples, no licences.
Run: python3 -I scripts/make_sfx.py"""
import math, os, random, struct, wave

SR = 48000
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "sfx")
random.seed(7)


def write(name, samples, gain=0.8):
    peak = max(1e-9, max(abs(s) for s in samples))
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, name + ".wav"), "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(32767 * gain * s / peak)) for s in samples))


def env(t, attack, decay):
    return (t / attack if t < attack else math.exp(-(t - attack) / decay))


def lowpass(xs, a):
    y, out = 0.0, []
    for x in xs:
        y += a * (x - y); out.append(y)
    return out


def shutter():  # two quick mechanical clicks with a short noise body
    n = int(0.16 * SR); noise = lowpass([random.uniform(-1, 1) for _ in range(n)], 0.35); s = []
    for i in range(n):
        t = i / SR
        a = env(t, 0.001, 0.012) + 0.7 * (env(t - 0.07, 0.001, 0.018) if t > 0.07 else 0)
        s.append(noise[i] * a + 0.3 * math.sin(2 * math.pi * 1800 * t) * env(t, 0.0005, 0.004))
    return s


def tick(freq=2600):  # scan lock
    n = int(0.06 * SR)
    return [math.sin(2 * math.pi * freq * i / SR) * env(i / SR, 0.0008, 0.012) for i in range(n)]


def land():  # soft fabric landing: low thump + brushed noise
    n = int(0.25 * SR); noise = lowpass([random.uniform(-1, 1) for _ in range(n)], 0.08); s = []
    for i in range(n):
        t = i / SR; f = 150 - 70 * min(1, t / 0.08)
        s.append(0.9 * math.sin(2 * math.pi * f * t) * env(t, 0.002, 0.05) + 0.5 * noise[i] * env(t, 0.004, 0.06))
    return s


def swipe():  # filtered noise sweep
    n = int(0.28 * SR); s = []; y = 0.0
    for i in range(n):
        t = i / SR; a = 0.04 + 0.4 * (t / 0.28)
        y += a * (random.uniform(-1, 1) - y)
        s.append(y * math.sin(math.pi * t / 0.28))
    return s


def click():  # crisp UI click for Swap
    n = int(0.05 * SR)
    return [(0.7 * math.sin(2 * math.pi * 3400 * i / SR) + 0.5 * math.sin(2 * math.pi * 1200 * i / SR))
            * env(i / SR, 0.0004, 0.007) for i in range(n)]


def hit():  # restrained brand impact: sub + soft shimmer tail
    n = int(1.6 * SR); noise = lowpass([random.uniform(-1, 1) for _ in range(n)], 0.5); s = []
    for i in range(n):
        t = i / SR; f = 70 - 25 * min(1, t / 0.3)
        body = math.sin(2 * math.pi * f * t) * env(t, 0.003, 0.35)
        shimmer = (math.sin(2 * math.pi * 1568 * t) + 0.6 * math.sin(2 * math.pi * 2349 * t)) * env(t, 0.01, 0.5) * 0.12
        s.append(body + shimmer + 0.08 * noise[i] * env(t, 0.002, 0.03))
    return s


def whoosh():  # short air movement for the assembly burst
    n = int(0.45 * SR); s = []; y = 0.0
    for i in range(n):
        t = i / SR; a = 0.02 + 0.25 * math.sin(math.pi * t / 0.45)
        y += a * (random.uniform(-1, 1) - y)
        s.append(y * math.sin(math.pi * t / 0.45) ** 1.5)
    return s


write("shutter", shutter(), 0.7); write("tick", tick(), 0.45); write("tick2", tick(3100), 0.45)
write("land", land(), 0.7); write("swipe", swipe(), 0.6); write("click", click(), 0.6)
write("hit", hit(), 0.85); write("whoosh", whoosh(), 0.6)
print(sorted(os.listdir(OUT)))
