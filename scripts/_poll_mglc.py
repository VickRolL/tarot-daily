"""轮询芒果灵创音频任务的落地情况。

判据用 audioUrl 非空，不用 status 字段 —— 提交时 status=1、查询时 status=0，
语义没在文档里写死，拿它当判据会自欺。
"""
import json
import subprocess
import sys
import time

TASKS = {
    '2052144838880960': 'ambient',
    '2052144884260544': 'sfx-test',
}


def query(tid):
    r = subprocess.run(
        f'mglc task status --task-id {tid}',
        shell=True, capture_output=True, text=True,
    )
    try:
        return json.loads(r.stdout)
    except Exception:
        return {'_raw': (r.stdout or r.stderr or '')[:400]}


def main():
    wait_s = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    rounds = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    for attempt in range(rounds):
        ready = 0
        rows = []
        for tid, label in TASKS.items():
            d = query(tid)
            data = d.get('data') or {}
            audios = data.get('audios') or []
            urls = [a.get('audioUrl') or '' for a in audios]
            got = [u for u in urls if u]
            rows.append(
                f'{label:9s} status={data.get("status")} '
                f'audios={len(audios)} urls={len(got)}'
            )
            if got:
                ready += 1
        print(f'--- attempt {attempt + 1} ---')
        for r in rows:
            print('   ', r)
        if ready == len(TASKS):
            print('ALL_READY')
            for tid, label in TASKS.items():
                d = query(tid)
                for a in (d.get('data') or {}).get('audios') or []:
                    print(f'   {label}\t{a.get("audioName")}\t{a.get("audioUrl")}')
            return
        time.sleep(wait_s)
    print('TIMEOUT')


if __name__ == '__main__':
    main()
