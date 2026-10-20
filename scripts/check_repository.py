"""Read-only pre-push audit. Reports file names, never credential contents."""

from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SECRET = re.compile(rb'(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')


def git_paths(*arguments):
    output = subprocess.check_output(['git', 'ls-files', *arguments, '-z'], cwd=ROOT)
    return [value.decode('utf-8') for value in output.split(b'\0') if value]


def audit():
    issues = [f'Tracked file now covered by .gitignore: {name}'
              for name in git_paths('-ci', '--exclude-standard')]
    names = git_paths('--cached', '--others', '--exclude-standard')
    for name in names:
        path = ROOT / name
        if not path.is_file():
            continue
        if path.stat().st_size > 5_000_000:
            issues.append(f'Large file needs review: {name}')
            continue
        if SECRET.search(path.read_bytes()):
            issues.append(f'Possible credential needs review: {name}')
    probes = ['.env.local', 'node_modules/example.js', 'dist/server/index.js',
              '.venv/pyvenv.cfg', 'tests/__pycache__/test.pyc', 'tsconfig.tsbuildinfo',
              '.sites-runtime/state.json', 'architect-lab-progress.json', '.aws/credentials']
    ignored = subprocess.run(['git', 'check-ignore', '--stdin', '-z'], cwd=ROOT,
                             input=('\0'.join(probes) + '\0').encode(), capture_output=True)
    if ignored.returncode not in (0, 1):
        raise RuntimeError('Git ignore audit failed: ' + ignored.stderr.decode())
    missing = set(probes) - set(ignored.stdout.decode().split('\0'))
    issues.extend(f'Local artifact is not ignored: {name}' for name in sorted(missing))
    if issues:
        print('\n'.join(issues))
        return 1
    print(f'Repository audit passed: {len(names)} source files checked; local artifacts ignored; no credential patterns found.')
    return 0


if __name__ == '__main__':
    sys.exit(audit())
