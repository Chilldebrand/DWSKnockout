export function getCountdownGame(games, pick) {
  if (!pick) return null

  return (
    games.find((game) => game.id === pick.game_id) ??
    games.find((game) => [game.home_team, game.away_team].includes(pick.team)) ??
    null
  )
}
