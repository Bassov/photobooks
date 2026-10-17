# Source once in agent preflight (do not execute). Puts Node matching .nvmrc
# major + pnpm on PATH for non-interactive shells without writing
# `.tool-versions` into the repo. POSIX sh (bash, dash, zsh via `sh`).
#
#   . scripts/agent-env.sh
#   # or: source scripts/agent-env.sh

_agent_env_repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
_agent_env_asdf_root="${ASDF_DATA_DIR:-$HOME/.asdf}"

if [ -d "$_agent_env_asdf_root/shims" ]; then
  case ":$PATH:" in
    *":$_agent_env_asdf_root/shims:"*) ;;
    *) export PATH="$_agent_env_asdf_root/shims:$PATH" ;;
  esac
fi

if [ -z "${ASDF_NODEJS_VERSION:-}" ] && [ -f "$_agent_env_repo_root/.nvmrc" ]; then
  _agent_env_nvmrc="$(tr -d '[:space:]' <"$_agent_env_repo_root/.nvmrc")"
  case "$_agent_env_nvmrc" in
    *[!0-9]*)
      if [ -d "$_agent_env_asdf_root/installs/nodejs/$_agent_env_nvmrc" ]; then
        export ASDF_NODEJS_VERSION="$_agent_env_nvmrc"
      fi
      ;;
    *)
      if [ -d "$_agent_env_asdf_root/installs/nodejs" ]; then
        _agent_env_resolved="$(
          ls -1 "$_agent_env_asdf_root/installs/nodejs" 2>/dev/null |
            grep -E "^${_agent_env_nvmrc}(\.|$)" |
            sort -V |
            tail -n 1
        )"
        if [ -n "$_agent_env_resolved" ] &&
          [ -d "$_agent_env_asdf_root/installs/nodejs/$_agent_env_resolved" ]; then
          export ASDF_NODEJS_VERSION="$_agent_env_resolved"
        fi
      fi
      ;;
  esac
  unset _agent_env_nvmrc _agent_env_resolved
fi

if [ -f "$_agent_env_repo_root/.nvmrc" ]; then
  _agent_env_want="$(tr -d '[:space:]' <"$_agent_env_repo_root/.nvmrc")"
  _agent_env_want_major="${_agent_env_want%%.*}"
  if command -v node >/dev/null 2>&1; then
    _agent_env_got="$(node -v 2>/dev/null | tr -d 'v')"
    _agent_env_got_major="${_agent_env_got%%.*}"
    if [ "$_agent_env_got_major" != "$_agent_env_want_major" ]; then
      echo "agent-env: node v${_agent_env_got} does not match .nvmrc ${_agent_env_want} (need major ${_agent_env_want_major})" >&2
    fi
  else
    echo "agent-env: node not on PATH after bootstrap (need Node ${_agent_env_want_major})" >&2
  fi
  unset _agent_env_want _agent_env_want_major _agent_env_got _agent_env_got_major
fi

unset _agent_env_repo_root _agent_env_asdf_root
