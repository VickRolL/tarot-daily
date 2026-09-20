"""一次性诊断：python 侧「回读 mp3 峰值」这条判据到底看不看得见过冲。

浏览器探针报 burst +0.7dBFS / flip +0.3dBFS，python 侧报 0.0。
两种可能：
  A. 解码器把输出钳在 ±1.0（dr_mp3 定点路径）→ 判据**天生瞎**，永远绿；
  B. 编码真的很干净，浏览器那边的量法有问题。
判据：**数一数有多少样本精确落在 ±1.0** —— 那是钳位的指纹（连续音频撞到
精确的 1.0 满刻度、且成片出现，不可能是巧合）。
"""
import numpy as np
import miniaudio

FILES = ['charge', 'burst', 'flip', 'reveal']
DB = lambda x: 20 * np.log10(x) if x > 0 else -999.0

for name in FILES:
    p = f'src/assets/audio/sfx/{name}.mp3'
    d = miniaudio.decode_file(
        p, output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1, sample_rate=44100
    )
    a = np.array(d.samples, dtype=np.float32)
    at_ceiling = int(np.sum(np.abs(a) >= 0.9999995))
    over = int(np.sum(np.abs(a) > 1.0))
    top = np.sort(np.abs(a))[-5:]
    print(
        f'{name:7s} n={len(a):7d}  max={float(np.abs(a).max()):.6f} ({DB(float(np.abs(a).max())):+.2f}dB)  '
        f'|v|>=0.9999995 的样本 {at_ceiling:5d}  |v|>1.0 的样本 {over}\n'
        f'          最大五个 |v|: ' + '  '.join(f'{v:.6f}' for v in top)
    )

    # 对照：s16 路径（如果输出就是整数域，那永远不可能过 1.0）
    d16 = miniaudio.decode_file(
        p, output_format=miniaudio.SampleFormat.SIGNED16, nchannels=1, sample_rate=44100
    )
    a16 = np.array(d16.samples, dtype=np.int16)
    print(f'          s16 路径 max={int(np.abs(a16).max())} / 32768 '
          f'= {DB(int(np.abs(a16).max())/32768):+.2f}dB   撞到 32767 的样本 {int(np.sum(np.abs(a16) >= 32767))}')

print()
print('★ 若 FLOAT32 里出现成片精确的 1.000000 → 解码器钳位，这条判据看不见过冲。')
