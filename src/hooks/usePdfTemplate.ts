import { useCallback, useEffect, useState } from 'react';
import { Api, type PdfTemplateConfig } from '../lib/api';

type State = {
  config: PdfTemplateConfig | null;
  loading: boolean;
  error: Error | null;
};

export const usePdfTemplate = (module: string) => {
  const [state, setState] = useState<State>({
    config: null,
    loading: true,
    error: null
  });

  const fetchTemplate = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const template = await Api.fetchPdfTemplate(module);
      setState({
        config: template.config,
        loading: false,
        error: null
      });
    } catch (error) {
      setState({
        config: null,
        loading: false,
        error: error as Error
      });
    }
  }, [module]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  return {
    config: state.config,
    loading: state.loading,
    error: state.error,
    refresh: fetchTemplate
  };
};

