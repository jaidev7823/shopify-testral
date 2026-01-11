import * as React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'ui-page': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { title?: string }, HTMLElement>;
      'ui-title-bar': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { title?: string }, HTMLElement>;
      's-app-nav': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      's-link': React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>;
    }
  }
}

export {};