# Sourced, not run: puts `pm2` on PATH if it is not there already.
#
# `pm2` is installed under one nvm Node version. nvm only puts a version's
# bin/ on PATH once something has `nvm use`'d it, so a shell running another
# version (the pre-push hook's, a manual one) does not find it. Found live: a
# push printed "PM2 does not have booklet-app" and skipped the redeploy while
# PM2 was running. The Node 24 install is tried first so the result does not
# depend on glob order.
#
# scripts/pm2-startup.sh has its own copy of this: launchd runs it from
# ~/.booklet/, where there is no repository to source from.
if ! command -v pm2 &>/dev/null; then
  for bin in "$HOME/.nvm/versions/node/v24.19.0/bin" "$HOME"/.nvm/versions/node/*/bin; do
    if [[ -x "$bin/pm2" ]]; then
      export PATH="$bin:$PATH"
      break
    fi
  done
fi
