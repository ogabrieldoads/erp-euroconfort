from pathlib import Path
import sys

from docx import Document
from docx.document import Document as DocumentObject
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph


def iter_blocks(parent):
    if isinstance(parent, DocumentObject):
        parent_elm = parent.element.body
    else:
        parent_elm = parent._tc

    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)


def clean(text):
    return " ".join(text.replace("\xa0", " ").split())


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract_docx.py input.docx output.txt")

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    doc = Document(str(input_path))
    lines = []

    for block in iter_blocks(doc):
        if isinstance(block, Paragraph):
            text = clean(block.text)
            if text:
                lines.append(text)
        else:
            lines.append("[TABELA]")
            for row in block.rows:
                cells = [clean(cell.text) for cell in row.cells]
                lines.append(" | ".join(cells))
            lines.append("[/TABELA]")

    output_path.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
