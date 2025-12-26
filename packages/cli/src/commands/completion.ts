/**
 * Shell completion generation command
 *
 * Generates shell completion scripts for bash, zsh, and fish.
 */

/**
 * Options for completion command
 */
export interface CompletionOptions {
  /** Shell type: bash, zsh, or fish */
  shell?: string
}

/**
 * Generate bash completion script
 */
function generateBashCompletion(): string {
  return `# ya-modbus bash completion

_ya_modbus_completion() {
    local cur prev opts base
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands
    local commands="read write show-defaults completion --help --version"

    # Global options
    local global_opts="--help --version"

    # Connection options
    local conn_opts="--driver --port --host --tcp-port --slave-id --baud-rate --parity --data-bits --stop-bits --timeout"

    # Command-specific options
    local read_opts="--data-point --all --format"
    local write_opts="--data-point --value --yes --verify"
    local show_defaults_opts="--driver --local --format"

    # Get the command
    local cmd=""
    for ((i=1; i<COMP_CWORD; i++)); do
        case "\${COMP_WORDS[i]}" in
            read|write|show-defaults|completion)
                cmd="\${COMP_WORDS[i]}"
                break
                ;;
        esac
    done

    # Completion based on context
    case "$prev" in
        --driver|-d)
            # Could list installed drivers, but keeping simple for now
            return 0
            ;;
        --format|-f)
            COMPREPLY=( $(compgen -W "table json" -- "$cur") )
            return 0
            ;;
        --parity)
            COMPREPLY=( $(compgen -W "none even odd" -- "$cur") )
            return 0
            ;;
        --data-bits)
            COMPREPLY=( $(compgen -W "7 8" -- "$cur") )
            return 0
            ;;
        --stop-bits)
            COMPREPLY=( $(compgen -W "1 2" -- "$cur") )
            return 0
            ;;
        --shell)
            COMPREPLY=( $(compgen -W "bash zsh fish" -- "$cur") )
            return 0
            ;;
    esac

    # Complete based on current command
    case "$cmd" in
        read)
            COMPREPLY=( $(compgen -W "$conn_opts $read_opts" -- "$cur") )
            return 0
            ;;
        write)
            COMPREPLY=( $(compgen -W "$conn_opts $write_opts" -- "$cur") )
            return 0
            ;;
        show-defaults)
            COMPREPLY=( $(compgen -W "$show_defaults_opts" -- "$cur") )
            return 0
            ;;
        completion)
            COMPREPLY=( $(compgen -W "--shell" -- "$cur") )
            return 0
            ;;
        *)
            COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
            return 0
            ;;
    esac
}

complete -F _ya_modbus_completion ya-modbus
`
}

/**
 * Generate zsh completion script
 */
function generateZshCompletion(): string {
  return `#compdef ya-modbus

_ya_modbus() {
    local -a commands

    commands=(
        'read:Read data points from device'
        'write:Write data point to device'
        'show-defaults:Show driver DEFAULT_CONFIG and SUPPORTED_CONFIG'
        'completion:Generate shell completion script'
    )

    _arguments \\
        '1: :->command' \\
        '*:: :->args'

    case $state in
        command)
            _describe 'command' commands
            ;;
        args)
            case $words[1] in
                read)
                    _arguments \\
                        '--driver[Driver package name]:package:' \\
                        '--port[Serial port]:path:_files' \\
                        '--host[TCP host]:host:' \\
                        '--tcp-port[TCP port]:port:' \\
                        '--slave-id[Modbus slave ID]:id:' \\
                        '--baud-rate[Baud rate]:rate:' \\
                        '--parity[Parity]:type:(none even odd)' \\
                        '--data-bits[Data bits]:bits:(7 8)' \\
                        '--stop-bits[Stop bits]:bits:(1 2)' \\
                        '--timeout[Timeout in ms]:ms:' \\
                        '--data-point[Data point IDs]:id:' \\
                        '--all[Read all data points]' \\
                        '--format[Output format]:format:(table json)'
                    ;;
                write)
                    _arguments \\
                        '--driver[Driver package name]:package:' \\
                        '--port[Serial port]:path:_files' \\
                        '--host[TCP host]:host:' \\
                        '--tcp-port[TCP port]:port:' \\
                        '--slave-id[Modbus slave ID]:id:' \\
                        '--baud-rate[Baud rate]:rate:' \\
                        '--parity[Parity]:type:(none even odd)' \\
                        '--data-bits[Data bits]:bits:(7 8)' \\
                        '--stop-bits[Stop bits]:bits:(1 2)' \\
                        '--timeout[Timeout in ms]:ms:' \\
                        '--data-point[Data point ID]:id:' \\
                        '--value[Value to write]:value:' \\
                        '--yes[Skip confirmation]' \\
                        '--verify[Verify written value]'
                    ;;
                show-defaults)
                    _arguments \\
                        '--driver[Driver package name]:package:' \\
                        '--local[Load from local package]' \\
                        '--format[Output format]:format:(table json)'
                    ;;
                completion)
                    _arguments \\
                        '--shell[Shell type]:shell:(bash zsh fish)'
                    ;;
            esac
            ;;
    esac
}

_ya_modbus
`
}

/**
 * Generate fish completion script
 */
function generateFishCompletion(): string {
  return `# ya-modbus fish completion

# Commands
complete -c ya-modbus -f -n '__fish_use_subcommand' -a 'read' -d 'Read data points from device'
complete -c ya-modbus -f -n '__fish_use_subcommand' -a 'write' -d 'Write data point to device'
complete -c ya-modbus -f -n '__fish_use_subcommand' -a 'show-defaults' -d 'Show driver DEFAULT_CONFIG and SUPPORTED_CONFIG'
complete -c ya-modbus -f -n '__fish_use_subcommand' -a 'completion' -d 'Generate shell completion script'

# Global options
complete -c ya-modbus -l help -d 'Show help'
complete -c ya-modbus -l version -d 'Show version'

# Connection options (for read and write)
complete -c ya-modbus -n '__fish_seen_subcommand_from read write' -l driver -s d -d 'Driver package name'
complete -c ya-modbus -n '__fish_seen_subcommand_from read write' -l port -s p -d 'Serial port for RTU'
complete -c ya-modbus -n '__fish_seen_subcommand_from read write' -l host -s h -d 'TCP host'
complete -c ya-modbus -n '__fish_seen_subcommand_from read write' -l tcp-port -d 'TCP port'
complete -c ya-modbus -n '__fish_seen_subcommand_from read write' -l slave-id -s s -d 'Modbus slave ID (1-247)'
complete -c ya-modbus -n '__fish_seen_subcommand_from read write' -l baud-rate -s b -d 'Baud rate (uses driver default)'
complete -c ya-modbus -n '__fish_seen_subcommand_from read write' -l parity -d 'Parity' -a 'none even odd'
complete -c ya-modbus -n '__fish_seen_subcommand_from read write' -l data-bits -d 'Data bits' -a '7 8'
complete -c ya-modbus -n '__fish_seen_subcommand_from read write' -l stop-bits -d 'Stop bits' -a '1 2'
complete -c ya-modbus -n '__fish_seen_subcommand_from read write' -l timeout -d 'Response timeout in ms'

# Read-specific options
complete -c ya-modbus -n '__fish_seen_subcommand_from read' -l data-point -d 'Data point ID(s) to read'
complete -c ya-modbus -n '__fish_seen_subcommand_from read' -l all -d 'Read all readable data points'
complete -c ya-modbus -n '__fish_seen_subcommand_from read' -l format -s f -d 'Output format' -a 'table json'

# Write-specific options
complete -c ya-modbus -n '__fish_seen_subcommand_from write' -l data-point -d 'Data point ID to write'
complete -c ya-modbus -n '__fish_seen_subcommand_from write' -l value -d 'Value to write'
complete -c ya-modbus -n '__fish_seen_subcommand_from write' -l yes -s y -d 'Skip confirmation'
complete -c ya-modbus -n '__fish_seen_subcommand_from write' -l verify -d 'Read back and verify'

# Show-defaults options
complete -c ya-modbus -n '__fish_seen_subcommand_from show-defaults' -l driver -s d -d 'Driver package name'
complete -c ya-modbus -n '__fish_seen_subcommand_from show-defaults' -l local -d 'Load from local package'
complete -c ya-modbus -n '__fish_seen_subcommand_from show-defaults' -l format -s f -d 'Output format' -a 'table json'

# Completion options
complete -c ya-modbus -n '__fish_seen_subcommand_from completion' -l shell -d 'Shell type' -a 'bash zsh fish'
`
}

/**
 * Completion command handler
 *
 * @param options - Command options
 */
export function completionCommand(options: CompletionOptions): void {
  const shell = options.shell ?? 'bash'

  let script: string
  switch (shell) {
    case 'bash':
      script = generateBashCompletion()
      break
    case 'zsh':
      script = generateZshCompletion()
      break
    case 'fish':
      script = generateFishCompletion()
      break
    default:
      throw new Error(`Unsupported shell: ${shell}. Supported: bash, zsh, fish`)
  }

  console.log(script)

  // Print installation instructions to stderr so they don't interfere with script output
  console.error(`
# Installation instructions for ${shell}:
`)

  switch (shell) {
    case 'bash':
      console.error(`# Add to ~/.bashrc or ~/.bash_profile:
source <(ya-modbus completion --shell bash)

# Or save to completion directory:
ya-modbus completion --shell bash > /etc/bash_completion.d/ya-modbus`)
      break

    case 'zsh':
      console.error(`# Add to ~/.zshrc:
source <(ya-modbus completion --shell zsh)

# Or save to fpath:
ya-modbus completion --shell zsh > ~/.zsh/completion/_ya-modbus
# Then add to ~/.zshrc: fpath=(~/.zsh/completion $fpath)`)
      break

    case 'fish':
      console.error(`# Save to fish completions directory:
ya-modbus completion --shell fish > ~/.config/fish/completions/ya-modbus.fish`)
      break
  }
}
