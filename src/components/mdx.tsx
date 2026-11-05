import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Callout } from 'fumadocs-ui/components/callout';
import { Card as BaseCard } from 'fumadocs-ui/components/card';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { useI18n } from 'fumadocs-ui/contexts/i18n';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import type { ComponentProps } from 'react';
import { localizedPath } from '@/lib/i18n';
import { Edition } from './edition';
import { Shot } from './shot';

/** Pages write links to each other as /docs/…; in a translated page they go to the translated page. */
function useLocalHref() {
  const { locale } = useI18n();
  return (href: string | undefined) => (href?.startsWith('/docs') ? localizedPath(locale, href) : href);
}

const BaseA = defaultMdxComponents.a as React.ComponentType<ComponentProps<'a'>>;
function A(props: ComponentProps<'a'>) {
  const local = useLocalHref();
  return <BaseA {...props} href={local(props.href)} />;
}
function Card(props: ComponentProps<typeof BaseCard>) {
  const local = useLocalHref();
  return <BaseCard {...props} href={local(props.href as string | undefined)} />;
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    a: A,
    Accordion,
    Accordions,
    Callout,
    Card,
    Steps,
    Step,
    Tabs,
    Tab,
    Shot,
    Edition,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
