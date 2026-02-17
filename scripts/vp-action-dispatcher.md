# VP Action Item Dispatcher Logic

## Schedule Design

### Weekday Business Hours (6am-8pm CET = 5:00-19:00 UTC)
Every 30 min, one VP is spawned in rotation:
- :00 → Nadia
- :30 → Max
- +1h :00 → Elena
- +1h :30 → Viktor
- +2h :00 → Zara
- +2h :30 → Nadia (cycle repeats)

Each VP gets spawned ~every 2.5 hours during business hours.
~6 spawns per VP per business day.

### Off-Hours & Weekends (8pm-6am CET + all day Sat/Sun)
Every 2 hours, one VP in rotation:
- Same rotation order, but only fires every 2h
- Each VP ~every 10 hours off-peak
- ~2-3 spawns per VP per off-peak period

## VP → Agent ID mapping
- Nadia → nadia (R&I)
- Max → max (M&C)
- Elena → elena (S&BD)
- Viktor → viktor (ENG)
- Zara → zara (D&B)
