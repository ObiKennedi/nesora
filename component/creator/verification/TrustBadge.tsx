// components/creator/verification/TrustBadge.tsx
import { CheckCircle, Circle, Award } from "lucide-react"
import "@/styles/creator/verification/TrustBadge.scss"

type Props = {
    progress:   number
    trustScore: number
    steps: {
        identityDocument: boolean
        selfie:           boolean
        address:          boolean
        personalInfo:     boolean
    }
}

const stepLabels = {
    personalInfo:     "Personal Information",
    identityDocument: "Identity Document",
    selfie:           "Selfie Verification",
    address:          "Address Verification",
}

const getScoreTier = (score: number) => {
    if (score >= 80) return { label: "Excellent", color: "green"  }
    if (score >= 60) return { label: "Good",      color: "blue"   }
    if (score >= 40) return { label: "Fair",      color: "amber"  }
    return                  { label: "Building",  color: "red"    }
}

export const TrustBadge = ({ progress, trustScore, steps }: Props) => {

    const tier = getScoreTier(trustScore)

    return (
        <div className="trust-badge">

            {/* ── Trust score ── */}
            <div className="trust-badge__score-section">
                <div className="trust-score-ring">
                    <svg viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#E0DDD9" strokeWidth="8" />
                        <circle
                            cx="50" cy="50" r="42" fill="none"
                            stroke="#c2622a" strokeWidth="8"
                            strokeDasharray={`${(trustScore / 100) * 264} 264`}
                            strokeLinecap="round"
                            transform="rotate(-90 50 50)"
                        />
                    </svg>
                    <div className="trust-score-ring__center">
                        <span className="trust-score-ring__value">{trustScore}</span>
                        <span className="trust-score-ring__max">/100</span>
                    </div>
                </div>
                <div className="trust-badge__score-info">
                    <span className={`trust-tier trust-tier--${tier.color}`}>
                        <Award size={12} /> {tier.label}
                    </span>
                    <p>Creator Trust Score</p>
                </div>
            </div>

            {/* ── Progress ── */}
            <div className="trust-badge__progress-section">
                <div className="trust-badge__progress-header">
                    <span>Verification Progress</span>
                    <span className="trust-badge__progress-pct">{progress}%</span>
                </div>
                <div className="trust-badge__progress-bar">
                    <div className="trust-badge__progress-fill" style={{ width: `${progress}%` }} />
                </div>

                <div className="trust-badge__steps">
                    {Object.entries(steps).map(([key, done]) => (
                        <div key={key} className={`trust-step ${done ? "trust-step--done" : ""}`}>
                            {done
                                ? <CheckCircle size={15} />
                                : <Circle      size={15} />
                            }
                            <span>{stepLabels[key as keyof typeof stepLabels]}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Score factors ── */}
            <div className="trust-badge__factors">
                <p className="trust-badge__factors-title">How your score is calculated</p>
                <ul>
                    <li>Verification status — up to 40 pts</li>
                    <li>Follower count — up to 20 pts</li>
                    <li>Active subscribers — up to 20 pts</li>
                    <li>Published content — up to 10 pts</li>
                    <li>Account age — up to 10 pts</li>
                </ul>
            </div>

        </div>
    )
}