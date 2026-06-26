/* Native Mach-O entry — Gatekeeper rejects bash scripts when app is quarantined. */
#include <limits.h>
#include <mach-o/dyld.h>
#include <stdlib.h>
#include <unistd.h>

int main(void) {
  char path[PATH_MAX];
  uint32_t size = sizeof(path);

  if (_NSGetExecutablePath(path, &size) != 0) {
    return 1;
  }

  /* .../Play Takico.app/Contents/MacOS/launcher -> Contents/Resources */
  if (chdir(path) != 0) {
    return 1;
  }
  if (chdir("../Resources") != 0) {
    return 1;
  }

  execl("/bin/bash", "bash", "launch.sh", (char *)NULL);
  return 1;
}
