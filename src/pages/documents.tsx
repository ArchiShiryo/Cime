import React from "react";
import { BackButton } from "@/components/ui/back-button";
import { KnowledgeSettings } from "@/components/KnowledgeSettings";
import { KnowledgeSearchBox } from "@/components/KnowledgeSearchBox";

const DocumentsPage: React.FC = () => {
  return (
    <div className="w-full min-h-screen px-8 py-4">
      <div className="max-w-5xl space-y-8 pb-12">
        <BackButton />
        <header className="text-left">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            Documents
          </h1>
          <p className="text-md text-gray-600 dark:text-gray-400">
            Vos documents (PDF, Word, Excel, PowerPoint, texte) que l&apos;agent
            peut consulter pour répondre.
          </p>
        </header>
        <KnowledgeSettings showHeader={false} />
        <KnowledgeSearchBox />
      </div>
    </div>
  );
};

export default DocumentsPage;
