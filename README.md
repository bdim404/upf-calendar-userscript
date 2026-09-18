# UPF Calendar Exporter

A userscript that exports your UPF timetable to a CSV file you can import into Google Calendar, Apple Calendar, or Outlook.

No login details, no cookies to copy, no command line. Open your timetable, pick a date range, click a button.

## Why

UPF's timetable lives behind Secretaria Virtual and has no export button. Copying a whole year of classes by hand is tedious, and the schedule changes often enough that you end up doing it more than once.

This script reads the same data the timetable page already loads and turns it into a standard calendar CSV.

## Install

1. Install a userscript manager:
   - [Tampermonkey](https://www.tampermonkey.net/) — Chrome, Edge, Safari, Firefox
   - [Violentmonkey](https://violentmonkey.github.io/) — open-source alternative
2. Open [`upf-calendar-exporter.user.js`](upf-calendar-exporter.user.js), click **Raw**, and confirm the install prompt.

## Usage

1. Log in to [Campus Global](https://www.upf.edu/intranet/campus-global/).
2. Go to **Els meus horaris** → **Veure Calendari**, and wait for your timetable to appear.
3. An **Export calendar** panel appears in the top-right corner. Set:

   | Field | Meaning |
   |---|---|
   | From / To | Date range to export. Defaults to the current academic year (1 Sep – 31 Jul). |
   | Exclude subjects | Comma-separated text. Any class whose name contains one of these is skipped — useful for `Master Thesis` and other placeholder entries. Case-insensitive. |
   | Include holidays | Off by default. UPF returns holidays and non-teaching days as fake 11:00–19:00 events, which clutter your calendar. |

4. Click **Download CSV**. The panel reports how many events were exported.

### Import into Google Calendar

1. Go to [Google Calendar settings → Import & export](https://calendar.google.com/calendar/r/settings/export).
2. Select `upf_calendar.csv` and choose a destination calendar.

**Create a new calendar first and import into that.** Your classes stay separate from your personal events, so you can recolor or delete them all at once when the timetable changes.

Apple Calendar and Outlook accept the same file via **File → Import**.

## What you get

One event per class, with:

- **Title** — subject name and session type, e.g. `Machine Learning for Sound and Music [Theory]`
- **Location** — room number, e.g. `52.329`
- **Description** — group, teachers, and subject code
- Events marked private; the file is UTF-8 with BOM, so accented names survive Excel

## Troubleshooting

**"Session expired. Reload the page and try again."**
Secretaria Virtual sessions are short. Reload the timetable page, let it render, then export again.

**"No events in that range."**
Check the date range. UPF only has data for academic years you were enrolled in, and the range must start before it ends.

**The panel never appears.**
It only runs on the timetable page itself (`secretariavirtual.upf.edu/pds/control/PubliHoraAlumCalendario`). If you are on a different page, navigate to your timetable. Otherwise check the script is enabled in your userscript manager.

**Some classes are missing.**
The script exports exactly what the timetable page shows. If a subject is missing there too, it is not yet published in Secretaria Virtual.

## How it works

The timetable page fetches its events from an internal endpoint:

```
POST /pds/control/[Ajax]selecionarRangoHorarios?start=<epoch>&end=<epoch>
```

The script calls that same endpoint from the page, so your existing session authenticates the request — nothing is sent anywhere else. The response is filtered and written out in [Google Calendar's CSV format](https://support.google.com/calendar/answer/37118).

## Notes

This is not affiliated with or endorsed by UPF. It depends on an internal endpoint that UPF may change without notice; if exports suddenly stop working, please open an issue.

Originally a fix for [miquelvir/upf-calendar-exporter](https://github.com/miquelvir/upf-calendar-exporter), whose endpoint moved from `gestioacademica.upf.edu` to `secretariavirtual.upf.edu`. Rewritten as a userscript so no Python or cookie handling is needed.

## License

MIT
