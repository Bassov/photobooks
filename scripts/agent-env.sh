# Source once in agent preflight (do not execute). Puts Node 22 + pnpm on PATH
# for non-interactive shells without writing `.tool-versions` into the repo.
#
#   source scripts/agent-env.sh
#   # or: . scripts/agent-env.sh

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
  if [[ "$_agent_env_nvmrc" =~ ^[0-9]+$ ]] && [ -d "$_agent_env_asdf_root/installs/nodejs" ]; then
    _agent_env_resolved="$(
      ls -1 "$_agent_env_asdf_root/installs/nodejs" | grep -E "^${_agent_env_nvmrc}(\.|$)" | tail -n 1
    )"
    if [ -n "$_agent_env_resolved" ]; then
      export ASDF_NODEJS_VERSION="$_agent_env_resolved"
    fi
  else
    export ASDF_NODEJS_VERSION="$_agent_env_nvmrc"
  fi
  unset _agent_env_nvmrc _agent_env_resolved
fi

unset _agent_env_repo_root _agent_env_asdf_root
