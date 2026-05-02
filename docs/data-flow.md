# ScoreXP Veri Akışı

Bu modelde tarayıcı Highlightly API'ye asla doğrudan gitmez. Bütün dış istekleri backend kontrol eder; frontend yalnızca stabil, normalize edilmiş scoreboard snapshot'ı okur.

```mermaid
flowchart LR
  B[Tarayıcı\nReact scoreboard] -->|30 sn sessiz fetch\nIf-None-Match + checksum| A[Fastify API\n/api/v1/football/scoreboard]

  subgraph Gate[Provider Request Gate]
    A --> C{Snapshot sıcak mı?}
    C -->|Evet| R[Redis / Memory\nhot cache]
    C -->|Bitmiş tarih kilitli| D[Durable Store\nfinished write-once]
    C -->|Süre doldu| P[Highlightly Football API\n/matches?date&timezone]
  end

  P -->|raw match payload| N[Normalize\nstatus, score, league, team]
  N --> M[Merge\npersisted finished matches]
  M --> S[Stable Snapshot\ncountry + league groups]
  S --> R
  S --> D
  S --> A
  A -->|JSON snapshot| B

  D -->|bitmiş maç varsa\ntekrar provider'a çıkma| A
```

## Yenileme Politikası

```mermaid
stateDiagram-v2
  [*] --> Upcoming: maç başlamadı
  Upcoming --> Live: provider state live
  Live --> Finished: final state
  Finished --> Locked: geçmiş tarih + tüm maçlar final

  Upcoming: Provider TTL 15 dakika
  Live: Provider TTL 3 dakika
  Finished: Provider TTL 24 saat
  Locked: Durable store, write-once
```

## Akış İlkeleri

- Canlı maç varsa provider tarafı en erken 3 dakikada bir yenilenir.
- Başlamamış maçlar için provider tarafı 15 dakika TTL ile korunur.
- Geçmiş ve tamamı bitmiş günler durable store'a kilitlenir; aynı gün için provider'a tekrar gidilmez.
- Frontend kendi sayfasını yenilemez; sadece data alanı sessiz şekilde checksum değişirse güncellenir.
- API anahtarı sadece backend environment değişkeninde bulunur.
