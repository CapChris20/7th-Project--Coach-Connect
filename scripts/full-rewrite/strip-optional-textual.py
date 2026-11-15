#!/usr/bin/env python3
"""
Expand ?. into nullish-safe form matching JS optional chaining semantics.
  a?.b / a?.[i] / a?.() / a.b()?.c / promise.catch?.()
Does not touch ??.
"""
import re
import sys
from pathlib import Path

def skip_string_forward(text, i):
    quote = text[i]
    i += 1
    while i < len(text):
        if text[i] == '\\':
            i += 2
            continue
        if text[i] == quote:
            return i + 1
        i += 1
    return i

def match_parens_forward(text, open_idx):
    depth = 1
    i = open_idx + 1
    while i < len(text) and depth:
        ch = text[i]
        if ch in ('"', "'", '`'):
            i = skip_string_forward(text, i)
            continue
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        i += 1
    return i

def match_brackets_forward(text, open_idx):
    depth = 1
    i = open_idx + 1
    while i < len(text) and depth:
        ch = text[i]
        if ch in ('"', "'", '`'):
            i = skip_string_forward(text, i)
            continue
        if ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
        i += 1
    return i

def in_line_comment(text, idx):
    line_start = text.rfind('\n', 0, idx) + 1
    return '//' in text[line_start:idx]

def read_ident_left(text, j):
    """j is last index of ident; return (start, end_exclusive)."""
    end = j + 1
    while j >= 0 and (text[j].isalnum() or text[j] in '_$'):
        j -= 1
    return j + 1, end

def same_line_spaces_left(text, j):
    """Skip spaces/tabs left, but stop at newline (do not climb into prior lines/comments)."""
    while j >= 0 and text[j] in (' ', '\t'):
        j -= 1
    return j

def extend_member_left(text, start):
    """
    start points at first char of a member/call/index expression already captured.
    Walk left over .ident / .call() on the SAME line only.
    Returns new start index.
    """
    while True:
        j = same_line_spaces_left(text, start - 1)
        if j < 0 or text[j] == '\n':
            return start
        # Stop if we would enter a line comment on this line
        line_start = text.rfind('\n', 0, start) + 1
        if '//' in text[line_start:start]:
            return start
        if text[j] == '.':
            j = same_line_spaces_left(text, j - 1)
            if j < 0 or text[j] == '\n':
                return start
            if j >= 0 and (text[j].isalnum() or text[j] in '_$'):
                ident_start, _ = read_ident_left(text, j)
                start = ident_start
                continue
            if j >= 0 and text[j] == ')':
                # receiver is a call: foo().bar
                depth = 1
                k = j - 1
                while k >= 0 and depth:
                    ch = text[k]
                    if ch == ')':
                        depth += 1
                    elif ch == '(':
                        depth -= 1
                    k -= 1
                if depth != 0:
                    return start
                start = k + 1
                j2 = same_line_spaces_left(text, start - 1)
                if j2 >= 0 and text[j2] != '\n' and (text[j2].isalnum() or text[j2] in '_$'):
                    ident_start, _ = read_ident_left(text, j2)
                    start = ident_start
                continue
            return start
        # Do not climb through bare ')' / ']' — that would swallow `if (x) fn?.()`
        # into `(x) fn`. Call/index receivers are handled inside the '.' branch only.
        return start

def find_object_span(text, opt_idx):
    """
    Find [obj_start, obj_end) for the expression immediately left of ?.
    """
    j = opt_idx - 1
    while j >= 0 and text[j].isspace():
        j -= 1
    if j < 0:
        return None

    if text[j].isalnum() or text[j] in '_$':
        ident_start, ident_end = read_ident_left(text, j)
        obj_start = extend_member_left(text, ident_start)
        return obj_start, ident_end

    if text[j] == ')':
        depth = 1
        k = j - 1
        while k >= 0 and depth:
            ch = text[k]
            if ch == ')':
                depth += 1
            elif ch == '(':
                depth -= 1
            k -= 1
        if depth != 0:
            return None
        # include callee before (
        call_open = k + 1
        obj_start = extend_member_left(text, call_open)
        # Also pull bare ident callee: foo()
        j2 = call_open - 1
        while j2 >= 0 and text[j2].isspace():
            j2 -= 1
        if j2 >= 0 and (text[j2].isalnum() or text[j2] in '_$'):
            ident_start, _ = read_ident_left(text, j2)
            obj_start = extend_member_left(text, ident_start)
        return obj_start, j + 1

    if text[j] == ']':
        depth = 1
        k = j - 1
        while k >= 0 and depth:
            if text[k] == ']':
                depth += 1
            elif text[k] == '[':
                depth -= 1
            k -= 1
        if depth != 0:
            return None
        bracket_open = k + 1
        obj_start = extend_member_left(text, bracket_open)
        j2 = bracket_open - 1
        while j2 >= 0 and text[j2].isspace():
            j2 -= 1
        if j2 >= 0 and (text[j2].isalnum() or text[j2] in '_$'):
            ident_start, _ = read_ident_left(text, j2)
            obj_start = extend_member_left(text, ident_start)
        return obj_start, j + 1

    return None

def expand_all(text: str) -> tuple[str, int]:
    n = 0
    guard = 0
    while True:
        idx = text.find('?.')
        if idx < 0:
            break
        if in_line_comment(text, idx):
            text = text[:idx] + '.__OPT__.' + text[idx+2:]
            continue
        span = find_object_span(text, idx)
        if not span:
            text = text[:idx] + '.__OPT__.' + text[idx+2:]
            continue
        obj_start, obj_end = span
        obj = text[obj_start:obj_end]
        after = idx + 2
        if after < len(text) and text[after] == '(':
            close = match_parens_forward(text, after)
            args = text[after+1:close-1]
            repl = f'({obj} == null ? undefined : {obj}({args}))'
            text = text[:obj_start] + repl + text[close:]
        elif after < len(text) and text[after] == '[':
            close = match_brackets_forward(text, after)
            inside = text[after+1:close-1]
            repl = f'({obj} == null ? undefined : {obj}[{inside}])'
            text = text[:obj_start] + repl + text[close:]
        else:
            m = re.match(r'[A-Za-z_$][\w$]*', text[after:])
            if not m:
                text = text[:idx] + '.__OPT__.' + text[idx+2:]
                continue
            prop = m.group(0)
            prop_end = after + len(prop)
            # Optional method call: obj?.method(args)
            k = prop_end
            while k < len(text) and text[k].isspace():
                k += 1
            if k < len(text) and text[k] == '(':
                close = match_parens_forward(text, k)
                args = text[k+1:close-1]
                repl = f'({obj} == null ? undefined : {obj}.{prop}({args}))'
                text = text[:obj_start] + repl + text[close:]
            else:
                repl = f'({obj} == null ? undefined : {obj}.{prop})'
                text = text[:obj_start] + repl + text[prop_end:]
        n += 1
        guard += 1
        if guard > 10000:
            raise RuntimeError('too many expansions')
    text = text.replace('.__OPT__.', '?.')
    return text, n

def main():
    path = Path(sys.argv[1])
    text = path.read_text()
    before = len(re.findall(r'\?\.', text))
    text, n = expand_all(text)
    after = len(re.findall(r'\?\.', text))
    path.write_text(text)
    print(f'{path}: before={before} expansions={n} after={after}')
    if after:
        for m in re.finditer(r'^.*\?\..*$', text, re.M):
            print(' leftover:', m.group(0)[:160])

if __name__ == '__main__':
    main()
