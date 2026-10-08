"""Refresh the file:// navigation copy after editing page HTML. No dependencies."""
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
SHELL = ['site-brand', 'site-header', 'site-nav', 'site-footer']

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.depth = 0
        self.sections = {id: [] for id in ['page-content', *SHELL]}
        self.section = None
        self.icon = None
        self.title = []
        self.in_title = False
        self.found = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'title':
            self.in_title = True
        if tag == 'link' and attrs.get('rel') == 'icon':
            self.icon = attrs.get('href')
        if not self.depth and attrs.get('id') in self.sections:
            self.depth = 1
            self.section = attrs['id']
            if self.section == 'page-content':
                self.found = True
        elif self.depth:
            self.sections[self.section].append(self.get_starttag_text())
            if tag not in VOID:
                self.depth += 1

    def handle_startendtag(self, tag, attrs):
        if self.depth:
            self.sections[self.section].append(self.get_starttag_text())

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        if self.depth and tag not in VOID:
            self.depth -= 1
            if self.depth:
                self.sections[self.section].append('</' + tag + '>')
            else:
                self.section = None

    def handle_data(self, text):
        if self.depth:
            self.sections[self.section].append(text)
        if self.in_title:
            self.title.append(text)

    def handle_entityref(self, name):
        self.handle_data('&' + name + ';')

    def handle_charref(self, name):
        self.handle_data('&#' + name + ';')

    def handle_comment(self, text):
        if self.depth:
            self.sections[self.section].append('<!--' + text + '-->')

pages = {}
for file in sorted(ROOT.glob('*.html')):
    parser = PageParser()
    parser.feed(file.read_text(encoding='utf-8'))
    if parser.found:
        pages[file.stem] = {'title': unescape(''.join(parser.title)),
                           'content': ''.join(parser.sections['page-content']),
                           'icon': parser.icon,
                           'shell': {id: ''.join(parser.sections[id]) for id in SHELL}}
output = ROOT / 'assets/page-data.js'
output.write_text('window.JOINT_AREA_PAGES = ' + json.dumps(pages, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
print(f'Updated offline navigation for {len(pages)} pages.')
