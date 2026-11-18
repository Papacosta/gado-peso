import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

/**
 * Título padronizado de cada tela. O <h1> recebe o foco ao trocar de tela,
 * então leitores de tela anunciam onde a pessoa está.
 */
export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="page-head">
      <div className="page-head-row">
        <h1 className="page-title" tabIndex={-1} data-page-title>
          {title}
        </h1>
        {action}
      </div>
      {description && <p className="page-desc">{description}</p>}
    </div>
  );
}
