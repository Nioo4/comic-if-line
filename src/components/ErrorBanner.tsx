import type { SafeError } from "../lib/contracts.ts";

type ErrorBannerProps = {
  error: SafeError;
  onRetry?: () => void;
};

const errorLabels: Record<SafeError["code"], string> = {
  INVALID_INPUT: "输入需要调整",
  CONSTRAINT_CONFLICT: "发现约束冲突",
  REQUEST_TOO_LARGE: "输入内容过长",
  NO_VALID_BRANCH: "暂时没有合适分支",
  MODEL_RATE_LIMITED: "模型请求较忙",
  MODEL_OUTPUT_INVALID: "模型结果需要重试",
  MODEL_NOT_CONFIGURED: "模型尚未配置",
  MODEL_UNAVAILABLE: "模型暂时不可用",
  MODEL_TIMEOUT: "模型响应超时",
  INTERNAL_ERROR: "请求没有完成",
};

export default function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  return (
    <section className="error-banner" role="alert" aria-live="assertive">
      <div>
        <p className="section-kicker">{errorLabels[error.code]}</p>
        <p className="error-message">{error.message}</p>
        {error.requestId ? (
          <p className="request-id">请求编号：{error.requestId}</p>
        ) : null}
        {error.details ? (
          <div className="conflict-details">
            <p>{error.details.explanation}</p>
            <p className="muted">
              相关事实：{error.details.relatedFactIds.join("、") || "无"}
              <br />
              相关必达结果：
              {error.details.relatedMustHaveIds.join("、") || "无"}
              <br />
              相关约束：{error.details.relatedConstraintIds.join("、") || "无"}
              {error.details.relatedBranchId ? (
                <>
                  <br />相关分支：{error.details.relatedBranchId}
                </>
              ) : null}
            </p>
          </div>
        ) : null}
      </div>
      {error.retryable && onRetry ? (
        <button className="button button-secondary" type="button" onClick={onRetry}>
          按相同内容重试
        </button>
      ) : null}
    </section>
  );
}
