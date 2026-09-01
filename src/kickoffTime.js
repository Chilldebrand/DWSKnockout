export function formatLocalKickoff(kickoff, { locale, timeZone } = {}) {
  const date = new Date(kickoff)
  const dateOptions = { weekday: 'long', month: 'short', day: 'numeric' }
  const timeOptions = { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }

  if (timeZone) {
    dateOptions.timeZone = timeZone
    timeOptions.timeZone = timeZone
  }

  const localDate = new Intl.DateTimeFormat(locale, dateOptions).format(date)
  const localTime = new Intl.DateTimeFormat(locale, timeOptions).format(date)

  return `Kickoff on ${localDate} @ ${localTime}`
}
