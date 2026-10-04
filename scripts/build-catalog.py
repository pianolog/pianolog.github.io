"""Open Opus(https://openopus.org)에서 피아노 곡 목록을 받아 src/data/catalog.json을 만든다.

python3 scripts/build-catalog.py
"""
import json
import urllib.parse
import urllib.request

API = 'https://api.openopus.org'

# (검색어, 한글 이름)
COMPOSERS = [
    ('Bach', '바흐'), ('Scarlatti', '스카를라티'), ('Haydn', '하이든'), ('Mozart', '모차르트'),
    ('Beethoven', '베토벤'), ('Schubert', '슈베르트'), ('Mendelssohn', '멘델스존'), ('Robert Schumann', '슈만'),
    ('Chopin', '쇼팽'), ('Liszt', '리스트'), ('Brahms', '브람스'),
    ('Franck', '프랑크'), ('Saint', '생상스'), ('Grieg', '그리그'), ('Tchaikovsky', '차이콥스키'),
    ('Mussorgsky', '무소르그스키'), ('Albéniz', '알베니스'), ('Granados', '그라나도스'), ('Fauré', '포레'),
    ('Debussy', '드뷔시'), ('Satie', '사티'), ('Ravel', '라벨'), ('Scriabin', '스크리아빈'),
    ('Rachmaninoff', '라흐마니노프'), ('Prokofiev', '프로코피예프'), ('Shostakovich', '쇼스타코비치'),
    ('Bartók', '바르톡'), ('Messiaen', '메시앙'), ('Ligeti', '리게티'), ('Gershwin', '거슈윈'),
    ('Poulenc', '풀랑크'), ('Janáček', '야나체크'), ('Dvořák', '드보르자크'), ('Weber', '베버'),
    ('Field', '필드'), ('Busoni', '부조니'),
    # Open Opus에 없음: 클라라 슈만, 메트너, 클레멘티, 체르니
]


def get(path):
    with urllib.request.urlopen(API + path, timeout=20) as r:
        return json.load(r)


def find(term):
    d = get('/composer/list/search/' + urllib.parse.quote(term) + '.json')
    cs = d.get('composers') or []
    exact = [c for c in cs if term.lower() in c['complete_name'].lower()]
    return (exact or cs or [None])[0]


composers, works = [], []
for term, ko in COMPOSERS:
    c = find(term)
    if not c:
        print('없음:', term)
        continue
    ci = len(composers)
    composers.append({'id': c['id'], 'name': c['complete_name'], 'ko': ko})
    titles = []
    for genre in ('Keyboard', 'Orchestral', 'Chamber'):
        d = get(f"/work/list/composer/{c['id']}/genre/{genre}.json")
        for w in d.get('works') or []:
            t = w['title']
            # 오케스트라·실내악은 피아노가 주인공인 곡만 (협주곡, 피아노 트리오·5중주 등)
            if genre != 'Keyboard' and 'piano' not in t.lower():
                continue
            if t not in titles:
                titles.append(t)
    for t in titles:
        works.append([ci, t])
    print(f"{c['complete_name']}: {len(titles)}")

out = {'source': 'Open Opus (openopus.org)', 'composers': composers, 'works': works}
with open('src/data/catalog.json', 'w') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print('합계', len(works))
