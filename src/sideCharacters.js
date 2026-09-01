export function shouldShowSideCharacters(isSignedIn, pathname) {
  return isSignedIn && pathname !== '/'
}
