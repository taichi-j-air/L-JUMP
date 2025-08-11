import { useMemo } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
}

// Minimal, blog-like editor: size, bold, italic, underline, alignment, lists, links, quotes
export function RichTextEditor({ value, onChange, className }: RichTextEditorProps) {
  const modules = useMemo(() => ({
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      [{ size: ["small", false, "large", "huge"] }],
      ["bold", "italic", "underline"],
      [{ align: "" }, { align: "center" }, { align: "right" }, { align: "justify" }],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link", "blockquote"],
      ["clean"],
    ],
  }), []);

  const formats = [
    "header",
    "size",
    "bold",
    "italic",
    "underline",
    "align",
    "list",
    "bullet",
    "link",
    "blockquote",
  ];

  return (
    <div className={className}>
      <ReactQuill theme="snow" value={value} onChange={onChange} modules={modules} formats={formats} />
    </div>
  );
}

export default RichTextEditor;
