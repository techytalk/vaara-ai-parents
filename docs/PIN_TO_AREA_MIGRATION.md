# PIN circles and nearby features → area

**Status:** applied on 29 September 2026. Parents with a locality and city were moved onto that locality. Blank locality or city stayed on the PIN. The one unmapped listing and the non-PIN provider values stayed on the PIN fallback.  
**Date:** 29 September 2026.  
**Depends on:** [ONBOARDING_SCHOOL_FIRST_PLACE.md](./ONBOARDING_SCHOOL_FIRST_PLACE.md).

New onboarding already saves `user_locations.area_id` and joins `AREA_{area_id}`.
Existing parents, their PIN circles, and nearby product matches still use the
exact PIN. This document is the mapping and the cutover. No code from this
document has been applied.

## Live snapshot

Taken after migration `082_onboarding_areas` was applied.

| Item | Count |
| --- | --- |
| Parents with a location | 386 |
| Parents with `area_id` | 0 |
| PIN locality circles | 270 |
| PIN circles with at least one member | 267 |
| PIN-circle memberships | 386 |
| Messages inside PIN circles | 15 |
| Threads inside PIN circles | 0 |
| Listings | 1 |
| Carpool offers | 0 |
| Playdate opt-ins | 0 |
| Activity PIN rows | 1 |
| Providers with service PINs | 9 |

Largest PIN circles are not one locality:

| Circle | Members | Distinct localities typed by those members |
| --- | ---: | ---: |
| `PIN_560102` · HSR Layout | 54 | 9 |
| `PIN_502032` · Tellapur | 21 | 3 |
| `PIN_505001` · Ashok Nagar, Karimnagar | 7 | 5 |

Only 23 of 386 parents typed a locality that exactly matches a seeded
Hyderabad name. Parent cities are spread across Bengaluru (49), Hyderabad
(45), K.V. Rangareddy (29), Medak (28), and many hometowns. A PIN must not be
converted into one area.

The 15 PIN-circle messages are in `PIN_500100`, `PIN_560102`, `PIN_522601`,
`PIN_532243`, `PIN_504103`, `PIN_741160`, `PIN_754189`, `PIN_500047`,
`PIN_500055`, and `PIN_503001`.

## Mapping rule

Resolve each parent from their own `locality + city + country`, using the same
resolver as onboarding.

```text
user_locations.locality + city + IN
        |
        v
known area or alias  -> that area_id
safe suffix only     -> Gachibowli Village -> Gachibowli
otherwise            -> provisional area in that city
        |
        v
membership moves to AREA_{area_id}
message moves with its author
```

Do not use the PIN circle's display name. `PIN_560102` is labelled HSR Layout,
but its members typed nine different localities. Each member follows their own
locality.

Seeded Hyderabad names win over a district stored in `city`. Postal lookup
stored Rangareddy and Medak as the city for many west-Hyderabad parents. If
the locality is Gachibowli, Nanakramguda, Financial District, Rai Durg,
Kokapet, Kondapur, KPHB, Kukatpally, Madhapur, HITEC City, Jubilee Hills,
Banjara Hills, Manikonda, Miyapur, Nallagandla, or Tellapur, the area city is
Hyderabad. Every other locality keeps the city already stored, so a Karimnagar
or Bengaluru parent does not land in a Hyderabad circle.

Kondapur Phase 2 stays separate from Kondapur. Financial District stays
separate from Gachibowli. Nanakramguda and Raidurg use the aliases already
seeded.

## Circle move

| From | To |
| --- | --- |
| `PIN_{pin}` | `AREA_{area_id}`, display `{Area}, {City}` |
| `AGE_POSTAL_{country}_{pin}_{age}` | `AGE_AREA_{area_id}_{age}` |
| `COMM_{community}` | unchanged |

One area gets one circle. Kondapur parents from `500084` and `500032` join the
same Kondapur circle. HSR Layout and another locality that share `560102`
join different circles.

For each of the 15 messages:

- the channel message follows its author's resolved area;
- there are no threads to split;
- read state follows the member to the destination circle;
- the old PIN circle is archived only after its member count is zero and its
  message count has been checked.

Age-locality circles move with the same parent area. School, class, and
community circles are not part of this move.

## Nearby features

Match `area_id` when both sides have one. Keep the exact PIN comparison only
while a legacy row still has a null `area_id`.

| Surface | Current match | Change |
| --- | --- | --- |
| Feed / timeline | author PIN = viewer PIN | author `area_id` = viewer `area_id` |
| Listings | listing PIN = viewer PIN | copy `area_id` onto the listing at creation; backfill the one existing listing from the seller's resolved area, then leave it fixed if the seller later moves |
| Carpool | offer PIN + school | same school and `area_id`; no live offers to move |
| Playdates | opt-in PIN | store and match `area_id`; no live opt-ins to move |
| Activities | `activity_pin_codes` | add activity areas; map the one PIN through parents who currently have that PIN and a resolved area |
| Providers | `service_pin_codes` | add provider service areas; for each of the 9 providers, map each service PIN to the distinct resolved areas of parents on that PIN |
| Chat / discovery access | author PIN = viewer PIN, or circle metadata PIN | compare `area_id` |

School search can keep using the school address PIN. That PIN is the campus,
not the parent's home area.

## Dry run before any write

Print this report and stop. Do not update rows in the same run.

```text
parents resolved to an existing area
parents given a new provisional area
parents skipped because locality or city is blank
destination areas and how many parents each receives
PIN circles that split into more than one area
15 messages and the destination area of each author
listings, activity PINs, and provider PINs that could not be mapped
```

Apply the write only after that report is accepted. Take a database backup
first. The write is one transaction per parent batch:

```text
set user_locations.area_id
move circle membership
copy the 15 messages
re-sync that parent
archive the empty PIN circle
```

Listings, the activity PIN, and provider service areas are a second batch so a
circle problem does not leave those rows half-updated.

## Not in this change

- Publishing the phone update. The API deploy is live; the production OTA does
  not contain this onboarding yet.
- Asking parents to re-enter a place before the backfill.
- Merging provisional areas with the background model during the backfill.
  Unknown localities stay separate until that job runs later.
- Removing the PIN columns. They remain as reference until the null-`area_id`
  fallback has been unused.
