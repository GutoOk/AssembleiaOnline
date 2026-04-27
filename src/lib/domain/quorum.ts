export type QuorumType =
  | 'simple_majority'
  | 'absolute_majority'
  | 'two_thirds_majority';

export type PollResultInput = {
  quorumType?: QuorumType;
  favorVotes: number;
  contraVotes: number;
  abstentionVotes: number;
  totalActiveMembers?: number;
};

export type PollResultOutput = {
  status: 'Aprovada' | 'Reprovada' | 'Indeterminado';
  message: string;
};

export function calculatePollResult({
  quorumType,
  favorVotes,
  contraVotes,
  abstentionVotes,
  totalActiveMembers,
}: PollResultInput): PollResultOutput {
  switch (quorumType) {
    case 'simple_majority': {
      const oppositionVotes = contraVotes + abstentionVotes;
      const isApproved = favorVotes > oppositionVotes;

      return {
        status: isApproved ? 'Aprovada' : 'Reprovada',
        message: `Maioria simples: ${favorVotes} a favor contra ${oppositionVotes} votos contrários/abstenções (${contraVotes} contra e ${abstentionVotes} abstenções).`,
      };
    }

    case 'absolute_majority': {
      if (!totalActiveMembers || totalActiveMembers <= 0) {
        return {
          status: 'Indeterminado',
          message: 'Total de membros ativos não informado para cálculo de maioria absoluta.',
        };
      }

      const required = Math.floor(totalActiveMembers / 2) + 1;
      const isApproved = favorVotes >= required;

      return {
        status: isApproved ? 'Aprovada' : 'Reprovada',
        message: `Maioria absoluta: ${favorVotes} votos a favor de ${required} necessários. Abstenções não aprovam e, na prática, contam contra a formação da maioria.`,
      };
    }

    case 'two_thirds_majority': {
      const totalVotes = favorVotes + contraVotes + abstentionVotes;
      const required = Math.ceil((2 / 3) * totalVotes);
      const isApproved = totalVotes > 0 && favorVotes >= required;

      return {
        status: isApproved ? 'Aprovada' : 'Reprovada',
        message: `Maioria de 2/3: ${favorVotes} votos a favor de ${required} necessários, considerando ${totalVotes} votos totais, incluindo abstenções.`,
      };
    }

    default:
      return {
        status: 'Indeterminado',
        message: 'Tipo de quórum não reconhecido.',
      };
  }
}
