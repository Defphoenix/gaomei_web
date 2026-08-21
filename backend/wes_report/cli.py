from __future__ import annotations

import argparse

from .services import load_report_data, write_html, write_pdf


def main() -> None:
    parser = argparse.ArgumentParser(description="生成高美 WES HTML/PDF 报告")
    parser.add_argument("data", help="报告 JSON 数据文件")
    parser.add_argument("--html", help="HTML 输出路径")
    parser.add_argument("--pdf", help="PDF 输出路径")
    args = parser.parse_args()
    if not args.html and not args.pdf:
        parser.error("至少指定 --html 或 --pdf")

    data = load_report_data(args.data)
    if args.html:
        print(write_html(data, args.html))
    if args.pdf:
        print(write_pdf(data, args.pdf))


if __name__ == "__main__":
    main()

