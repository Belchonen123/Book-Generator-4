"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { tiptapToPlain } from "@/lib/text/tiptap";

export type ChapterEditorHandle = {
  setContent: (json: string | null, plain: string) => void;
  appendText: (text: string) => void;
  getJson: () => string;
  getPlain: () => string;
};

export function ChapterEditor({
  initialJson,
  onChange,
  editable = true,
  handleRef,
}: {
  initialJson: string | null;
  onChange?: (json: string, plain: string) => void;
  editable?: boolean;
  handleRef?: React.MutableRefObject<ChapterEditorHandle | null>;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: parseInitial(initialJson),
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral max-w-none min-h-[400px] rounded-md border border-input bg-background px-4 py-3 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      },
    },
    onUpdate({ editor }) {
      if (!onChange) return;
      const json = JSON.stringify(editor.getJSON());
      onChange(json, tiptapToPlain(json));
    },
  });

  const handleRefStable = useRef<ChapterEditorHandle | null>(null);
  useEffect(() => {
    if (!editor || !handleRef) return;
    const handle: ChapterEditorHandle = {
      setContent(json, _plain) {
        if (json) {
          try {
            editor.commands.setContent(JSON.parse(json));
          } catch {
            editor.commands.setContent({ type: "doc", content: [] });
          }
        } else {
          editor.commands.setContent({ type: "doc", content: [] });
        }
      },
      appendText(text) {
        editor
          .chain()
          .focus("end")
          .insertContent(text)
          .run();
      },
      getJson: () => JSON.stringify(editor.getJSON()),
      getPlain: () => tiptapToPlain(JSON.stringify(editor.getJSON())),
    };
    handleRefStable.current = handle;
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
    };
  }, [editor, handleRef]);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}

function parseInitial(json: string | null): unknown {
  if (!json) return { type: "doc", content: [] };
  try {
    return JSON.parse(json);
  } catch {
    return { type: "doc", content: [] };
  }
}
