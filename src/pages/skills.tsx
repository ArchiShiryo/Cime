import React from "react";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/ui/back-button";
import { SkillsSettings } from "@/components/SkillsSettings";

const SkillsPage: React.FC = () => {
  const { t } = useTranslation("cimes");
  return (
    <div className="w-full min-h-screen px-8 py-4">
      <div className="max-w-5xl space-y-8 pb-12">
        <BackButton />
        <header className="text-left">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            {t("skills.title")}
          </h1>
          <p className="text-md text-gray-600 dark:text-gray-400">
            {t("skills.pageIntro")}
          </p>
        </header>
        <SkillsSettings showHeader={false} tall />
      </div>
    </div>
  );
};

export default SkillsPage;
