export function formatMcServerPlayerList(players: string[]): string {
  if (players.length === 0) {
    return '当前没有玩家在线';
  }
  return players.join(' | ');
  // return players.reduce(
  //   (acc, name, index) => acc + `\n\t${index + 1}. ${name}`,
  //   '',
  // );
}
