import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Api,
  type Badge,
  type EmployeeBadge,
  type Reward,
  type MonthlyChallenge,
  type ChallengeParticipant,
  type EmployeeStatistics,
  type Leaderboard,
  type CreateChallengePayload,
  type AwardBadgePayload,
} from '../lib/api';
import type { Employee } from '../types/employees';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import {
  Trophy, Award, Target, TrendingUp, Users, Star, Medal, Gift, Calendar,
  Plus, Eye, ChevronRight, Flame, Zap, Crown, Shield, CheckCircle,
  Clock, BarChart3, User, Filter, RefreshCw
} from 'lucide-react';

type TabType = 'leaderboards' | 'badges' | 'challenges' | 'rewards' | 'statistics';

const RARITY_COLORS: Record<string, string> = {
  common: '#94a3b8',
  rare: '#3b82f6',
  epic: '#8b5cf6',
  legendary: '#f59e0b'
};

const RARITY_LABELS: Record<string, string> = {
  common: 'Commun',
  rare: 'Rare',
  epic: 'Épique',
  legendary: 'Légendaire'
};

export default function GamificationPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('leaderboards');
  const [loading, setLoading] = useState(true);

  // Leaderboards
  const [leaderboards, setLeaderboards] = useState<Record<string, Leaderboard>>({});
  const [leaderboardType, setLeaderboardType] = useState<'points' | 'volume' | 'badges'>('points');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time'>('monthly');

  // Badges
  const [badges, setBadges] = useState<Badge[]>([]);
  const [employeeBadges, setEmployeeBadges] = useState<EmployeeBadge[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [showAwardBadgeModal, setShowAwardBadgeModal] = useState(false);
  const [awardBadgeForm, setAwardBadgeForm] = useState<AwardBadgePayload>({ badge_id: '', earned_for: '' });

  // Challenges
  const [challenges, setChallenges] = useState<MonthlyChallenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<MonthlyChallenge | null>(null);
  const [challengeParticipants, setChallengeParticipants] = useState<ChallengeParticipant[]>([]);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeForm, setChallengeForm] = useState<CreateChallengePayload>({
    name: '',
    challenge_type: 'volume',
    target_value: 0,
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  });

  // Rewards
  const [rewards, setRewards] = useState<Reward[]>([]);

  // Statistics
  const [statistics, setStatistics] = useState<EmployeeStatistics | null>(null);
  const [statisticsPeriod, setStatisticsPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time'>('all_time');

  useEffect(() => {
    loadData();
  }, [activeTab, leaderboardType, leaderboardPeriod, selectedChallenge, selectedEmployee, statisticsPeriod, user, currentEmployee]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'leaderboards') {
        const leaderboard = await Api.fetchLeaderboard(leaderboardType, leaderboardPeriod);
        setLeaderboards({ [`${leaderboardType}-${leaderboardPeriod}`]: leaderboard });
      } else if (activeTab === 'badges') {
        const [badgesData, employeesData] = await Promise.all([
          Api.fetchBadges(),
          Api.fetchEmployees()
        ]);
        setBadges(badgesData);
        setEmployees(employeesData);
        // Trouver l'employé correspondant à l'utilisateur connecté
        if (user?.email) {
          const employee = employeesData.find((e) => e.email === user.email);
          setCurrentEmployee(employee || null);
        }
        if (selectedEmployee) {
          const badges = await Api.fetchEmployeeBadges(selectedEmployee);
          setEmployeeBadges(badges);
        }
      } else if (activeTab === 'challenges') {
        const challengesData = await Api.fetchChallenges(true);
        setChallenges(challengesData);
        if (selectedChallenge) {
          const participants = await Api.fetchChallengeParticipants(selectedChallenge.id);
          setChallengeParticipants(participants);
        }
      } else if (activeTab === 'rewards') {
        const rewardsData = await Api.fetchRewards();
        setRewards(rewardsData);
      } else if (activeTab === 'statistics') {
        // Charger les employés si nécessaire pour trouver l'employé de l'utilisateur
        if (!currentEmployee && user?.email) {
          const employeesData = await Api.fetchEmployees();
          const employee = employeesData.find((e) => e.email === user.email);
          setCurrentEmployee(employee || null);
          if (employee) {
            const stats = await Api.fetchEmployeeStatistics(employee.id, statisticsPeriod);
            setStatistics(stats);
          }
        } else if (currentEmployee) {
          const stats = await Api.fetchEmployeeStatistics(currentEmployee.id, statisticsPeriod);
          setStatistics(stats);
        }
      }
    } catch (error: any) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur chargement données');
    } finally {
      setLoading(false);
    }
  };

  const handleAwardBadge = async () => {
    if (!selectedEmployee || !awardBadgeForm.badge_id) {
      toast.error('Veuillez sélectionner un employé et un badge');
      return;
    }

    try {
      await Api.awardBadge(selectedEmployee, awardBadgeForm);
      toast.success('Badge attribué avec succès');
      setShowAwardBadgeModal(false);
      setAwardBadgeForm({ badge_id: '', earned_for: '' });
      loadData();
    } catch (error: any) {
      toast.error('Erreur attribution badge');
    }
  };

  const handleCreateChallenge = async () => {
    if (!challengeForm.name || !challengeForm.target_value) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    try {
      await Api.createChallenge(challengeForm);
      toast.success('Défi créé avec succès');
      setShowChallengeModal(false);
      setChallengeForm({
        name: '',
        challenge_type: 'volume',
        target_value: 0,
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
      });
      loadData();
    } catch (error: any) {
      toast.error('Erreur création défi');
    }
  };

  const handleClaimReward = async (rewardId: string) => {
    try {
      await Api.claimReward(rewardId);
      toast.success('Récompense réclamée avec succès');
      loadData();
    } catch (error: any) {
      toast.error('Erreur réclamation récompense');
    }
  };

  const currentLeaderboard = leaderboards[`${leaderboardType}-${leaderboardPeriod}`];
  const rankingData = currentLeaderboard?.ranking_data || [];

  return (
    <div className="gamification-page">
      <div className="page-header">
        <div>
          <h1>🎮 Gamification & Motivation</h1>
          <p>Tableaux de classement, badges, défis et récompenses</p>
        </div>
      </div>

      <div className="gamification-tabs">
        <button
          className={activeTab === 'leaderboards' ? 'active' : ''}
          onClick={() => setActiveTab('leaderboards')}
        >
          <Trophy size={18} />
          Classements
        </button>
        <button
          className={activeTab === 'badges' ? 'active' : ''}
          onClick={() => setActiveTab('badges')}
        >
          <Award size={18} />
          Badges
        </button>
        <button
          className={activeTab === 'challenges' ? 'active' : ''}
          onClick={() => setActiveTab('challenges')}
        >
          <Target size={18} />
          Défis
        </button>
        <button
          className={activeTab === 'rewards' ? 'active' : ''}
          onClick={() => setActiveTab('rewards')}
        >
          <Gift size={18} />
          Récompenses
        </button>
        <button
          className={activeTab === 'statistics' ? 'active' : ''}
          onClick={() => setActiveTab('statistics')}
        >
          <BarChart3 size={18} />
          Mes Statistiques
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <RefreshCw size={32} className="spinner" />
          <p>Chargement...</p>
        </div>
      ) : (
        <>
          {/* TAB: LEADERBOARDS */}
          {activeTab === 'leaderboards' && (
            <div className="gamification-content">
              <div className="leaderboard-filters">
                <div className="filter-group">
                  <label>Type de classement</label>
                  <select value={leaderboardType} onChange={(e) => setLeaderboardType(e.target.value as any)}>
                    <option value="points">Points</option>
                    <option value="volume">Volume</option>
                    <option value="badges">Badges</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Période</label>
                  <select value={leaderboardPeriod} onChange={(e) => setLeaderboardPeriod(e.target.value as any)}>
                    <option value="daily">Quotidien</option>
                    <option value="weekly">Hebdomadaire</option>
                    <option value="monthly">Mensuel</option>
                    <option value="yearly">Annuel</option>
                    <option value="all_time">Tous les temps</option>
                  </select>
                </div>
              </div>

              <div className="leaderboard-card">
                <div className="leaderboard-header">
                  <h2>
                    {leaderboardType === 'points' && <Star size={24} />}
                    {leaderboardType === 'volume' && <TrendingUp size={24} />}
                    {leaderboardType === 'badges' && <Award size={24} />}
                    Classement {leaderboardType === 'points' ? 'Points' : leaderboardType === 'volume' ? 'Volume' : 'Badges'}
                  </h2>
                </div>

                <div className="leaderboard-list">
                  {rankingData.length === 0 ? (
                    <div className="empty-state">
                      <Trophy size={48} />
                      <p>Aucun classement disponible</p>
                    </div>
                  ) : (
                    rankingData.map((entry, index) => (
                      <div key={entry.employee_id} className={`leaderboard-entry ${index < 3 ? 'top-three' : ''}`}>
                        <div className="rank">
                          {index === 0 && <Crown size={24} fill="#f59e0b" color="#f59e0b" />}
                          {index === 1 && <Medal size={24} fill="#94a3b8" color="#94a3b8" />}
                          {index === 2 && <Medal size={24} fill="#cd7f32" color="#cd7f32" />}
                          {index >= 3 && <span className="rank-number">{entry.rank}</span>}
                        </div>
                        <div className="entry-info">
                          <div className="entry-name">{entry.employee_name || 'Employé'}</div>
                          <div className="entry-value">
                            {leaderboardType === 'points' && `${entry.value} points`}
                            {leaderboardType === 'volume' && `${entry.value.toLocaleString('fr-FR')} kg`}
                            {leaderboardType === 'badges' && `${entry.value} badges`}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: BADGES */}
          {activeTab === 'badges' && (
            <div className="gamification-content">
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <div className="action-bar">
                  <button className="btn-primary" onClick={() => setShowAwardBadgeModal(true)}>
                    <Plus size={18} />
                    Attribuer un badge
                  </button>
                </div>
              )}

              <div className="badges-section">
                <div className="badges-grid">
                  {badges.map((badge) => (
                    <div key={badge.id} className="badge-card" style={{ borderColor: RARITY_COLORS[badge.rarity] }}>
                      <div className="badge-icon" style={{ color: RARITY_COLORS[badge.rarity] }}>
                        {badge.icon ? <span>{badge.icon}</span> : <Award size={32} />}
                      </div>
                      <div className="badge-info">
                        <h3>{badge.name}</h3>
                        <p>{badge.description}</p>
                        <div className="badge-meta">
                          <span className="rarity-badge" style={{ backgroundColor: RARITY_COLORS[badge.rarity] }}>
                            {RARITY_LABELS[badge.rarity]}
                          </span>
                          <span className="points">{badge.points} pts</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedEmployee && (
                <div className="employee-badges-section">
                  <h3>Badges de l'employé</h3>
                  <div className="employee-badges-grid">
                    {employeeBadges.map((eb) => (
                      <div key={eb.id} className="earned-badge-card">
                        <div className="badge-icon" style={{ color: RARITY_COLORS[eb.rarity || 'common'] }}>
                          {eb.icon ? <span>{eb.icon}</span> : <Award size={24} />}
                        </div>
                        <div className="badge-info">
                          <h4>{eb.name}</h4>
                          <p className="earned-date">Gagné le {format(new Date(eb.earned_at), 'dd MMM yyyy', { locale: fr })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: CHALLENGES */}
          {activeTab === 'challenges' && (
            <div className="gamification-content">
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <div className="action-bar">
                  <button className="btn-primary" onClick={() => setShowChallengeModal(true)}>
                    <Plus size={18} />
                    Créer un défi
                  </button>
                </div>
              )}

              <div className="challenges-grid">
                {challenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className="challenge-card"
                    onClick={() => {
                      setSelectedChallenge(challenge);
                      loadData();
                    }}
                  >
                    <div className="challenge-header">
                      <Target size={24} />
                      <h3>{challenge.name}</h3>
                    </div>
                    <p>{challenge.description}</p>
                    <div className="challenge-meta">
                      <span className="challenge-type">{challenge.challenge_type}</span>
                      <span className="challenge-target">
                        Objectif: {challenge.target_value} {challenge.unit || ''}
                      </span>
                    </div>
                    <div className="challenge-dates">
                      <Calendar size={16} />
                      {format(new Date(challenge.start_date), 'dd MMM', { locale: fr })} - {format(new Date(challenge.end_date), 'dd MMM yyyy', { locale: fr })}
                    </div>
                  </div>
                ))}
              </div>

              {selectedChallenge && (
                <div className="modal-backdrop" onClick={() => setSelectedChallenge(null)}>
                  <div className="modal-panel unified-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                      <h2 className="modal-title">{selectedChallenge.name}</h2>
                      <button
                        type="button"
                        className="modal-close"
                        onClick={() => setSelectedChallenge(null)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="modal-body">
                      <p>{selectedChallenge.description}</p>
                      <div className="participants-list">
                        <h3>Participants</h3>
                        {challengeParticipants.map((p, index) => (
                          <div key={p.id} className="participant-entry">
                            <span className="participant-rank">#{index + 1}</span>
                            <span className="participant-name">
                              {p.participant_type === 'team' ? p.team_name : `${p.first_name} ${p.last_name}`}
                            </span>
                            <span className="participant-progress">
                              {p.current_value} / {selectedChallenge.target_value} ({p.progress_percentage.toFixed(1)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: REWARDS */}
          {activeTab === 'rewards' && (
            <div className="gamification-content">
              <div className="rewards-grid">
                {rewards.map((reward) => (
                  <div key={reward.id} className="reward-card">
                    <Gift size={32} />
                    <h3>{reward.name}</h3>
                    <p>{reward.description}</p>
                    <div className="reward-cost">
                      {reward.points_cost && <span>{reward.points_cost} points</span>}
                      {reward.monetary_value && <span>{reward.monetary_value}€</span>}
                    </div>
                    <button className="btn-primary" onClick={() => handleClaimReward(reward.id)}>
                      Réclamer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: STATISTICS */}
          {activeTab === 'statistics' && (
            <div className="gamification-content">
              <div className="statistics-filters">
                <select value={statisticsPeriod} onChange={(e) => setStatisticsPeriod(e.target.value as any)}>
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                  <option value="yearly">Annuel</option>
                  <option value="all_time">Tous les temps</option>
                </select>
              </div>

              {statistics ? (
                <div className="statistics-grid">
                  <div className="stat-card">
                    <Star size={24} />
                    <div className="stat-value">{statistics.total_points}</div>
                    <div className="stat-label">Points totaux</div>
                  </div>
                  <div className="stat-card">
                    <Award size={24} />
                    <div className="stat-value">{statistics.badges_count}</div>
                    <div className="stat-label">Badges</div>
                  </div>
                  <div className="stat-card">
                    <TrendingUp size={24} />
                    <div className="stat-value">{statistics.total_volume_kg.toLocaleString('fr-FR')}</div>
                    <div className="stat-label">Volume (kg)</div>
                  </div>
                  <div className="stat-card">
                    <Target size={24} />
                    <div className="stat-value">{statistics.challenges_won}</div>
                    <div className="stat-label">Défis gagnés</div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <BarChart3 size={48} />
                  <p>Aucune statistique disponible</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL: Award Badge */}
      {showAwardBadgeModal && (
        <div className="modal-backdrop" onClick={() => setShowAwardBadgeModal(false)}>
          <div className="modal-panel unified-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Attribuer un badge</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowAwardBadgeModal(false)}
              >
                ×
              </button>
            </div>
            <form className="modal-body" onSubmit={(e) => { e.preventDefault(); handleAwardBadge(); }}>
              <div className="form-section">
                <div className="form-group">
                  <label htmlFor="award-employee">Employé</label>
                  <select
                    id="award-employee"
                    value={selectedEmployee || ''}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                  >
                    <option value="">Sélectionner un employé</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.first_name} {e.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="award-badge">Badge</label>
                  <select
                    id="award-badge"
                    value={awardBadgeForm.badge_id}
                    onChange={(e) => setAwardBadgeForm({ ...awardBadgeForm, badge_id: e.target.value })}
                  >
                    <option value="">Sélectionner un badge</option>
                    {badges.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="award-reason">Raison (optionnel)</label>
                  <textarea
                    id="award-reason"
                    value={awardBadgeForm.earned_for || ''}
                    onChange={(e) => setAwardBadgeForm({ ...awardBadgeForm, earned_for: e.target.value })}
                    rows={3}
                    placeholder="Pourquoi ce badge est attribué..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAwardBadgeModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Attribuer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Challenge */}
      {showChallengeModal && (
        <div className="modal-backdrop" onClick={() => setShowChallengeModal(false)}>
          <div className="modal-panel unified-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Créer un défi</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowChallengeModal(false)}
              >
                ×
              </button>
            </div>
            <form className="modal-body" onSubmit={(e) => { e.preventDefault(); handleCreateChallenge(); }}>
              <div className="form-section">
                <div className="form-group">
                  <label htmlFor="challenge-name">
                    Nom du défi <span className="required-indicator">*</span>
                  </label>
                  <input
                    id="challenge-name"
                    type="text"
                    value={challengeForm.name}
                    onChange={(e) => setChallengeForm({ ...challengeForm, name: e.target.value })}
                    placeholder="Ex: Défi Volume Mensuel"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="challenge-description">Description</label>
                  <textarea
                    id="challenge-description"
                    value={challengeForm.description || ''}
                    onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })}
                    rows={3}
                    placeholder="Description du défi..."
                  />
                </div>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label htmlFor="challenge-type">
                      Type de défi <span className="required-indicator">*</span>
                    </label>
                    <select
                      id="challenge-type"
                      value={challengeForm.challenge_type}
                      onChange={(e) => setChallengeForm({ ...challengeForm, challenge_type: e.target.value as any })}
                      required
                    >
                      <option value="volume">Volume</option>
                      <option value="quality">Qualité</option>
                      <option value="efficiency">Efficacité</option>
                      <option value="team">Équipe</option>
                      <option value="individual">Individuel</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="challenge-target">
                      Valeur cible <span className="required-indicator">*</span>
                    </label>
                    <input
                      id="challenge-target"
                      type="number"
                      value={challengeForm.target_value}
                      onChange={(e) => setChallengeForm({ ...challengeForm, target_value: parseFloat(e.target.value) })}
                      placeholder="1000"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="challenge-unit">Unité</label>
                    <input
                      id="challenge-unit"
                      type="text"
                      value={challengeForm.unit || ''}
                      onChange={(e) => setChallengeForm({ ...challengeForm, unit: e.target.value })}
                      placeholder="kg, %, etc."
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="challenge-start-date">
                      Date de début <span className="required-indicator">*</span>
                    </label>
                    <input
                      id="challenge-start-date"
                      type="date"
                      value={challengeForm.start_date}
                      onChange={(e) => setChallengeForm({ ...challengeForm, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="challenge-end-date">
                      Date de fin <span className="required-indicator">*</span>
                    </label>
                    <input
                      id="challenge-end-date"
                      type="date"
                      value={challengeForm.end_date}
                      onChange={(e) => setChallengeForm({ ...challengeForm, end_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowChallengeModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

