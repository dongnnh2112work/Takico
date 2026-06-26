/* Native Mach-O entry — Gatekeeper rejects bash scripts when app is quarantined. */
#include <libgen.h>
#include <limits.h>
#include <mach-o/dyld.h>
#include <string.h>
#include <unistd.h>

int main(void) {
  char path[PATH_MAX];
  char dirbuf[PATH_MAX];
  uint32_t size = sizeof(path);

  if (_NSGetExecutablePath(path, &size) != 0) {
    return 1;
  }

  /* path = .../Play Takico.app/Contents/MacOS/launcher (file) */
  strncpy(dirbuf, path, sizeof(dirbuf));
  dirbuf[sizeof(dirbuf) - 1] = '\0';
  if (chdir(dirname(dirbuf)) != 0) {
    return 1;
  }
  if (chdir("../Resources") != 0) {
    return 1;
  }

  execl("/bin/bash", "bash", "launch.sh", (char *)NULL);
  return 1;
}
