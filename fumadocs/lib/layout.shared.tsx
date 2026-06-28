import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import { AppWindow } from 'lucide-react';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "SEMS Documentation",
    },
    links: [
      {
        label: "Visit Platform",
        icon: <AppWindow />,
        text: "Platform",
        url: "https://sems.monash.edu.my/",
      },
    ],
  };
}
