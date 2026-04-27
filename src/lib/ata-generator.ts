'use client';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { UserOptions } from 'jspdf-autotable';
import {
  Assembly,
  AtaItem,
  Poll,
  Vote,
  UserProfile,
  PollOption,
} from '@/lib/data';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  documentId,
} from 'firebase/firestore';
import { calculatePollResult } from './domain/quorum';


const DISCLAIMER_TEXT =
  'Este documento é uma cópia preliminar gerada pelo sistema para simples conferência e não possui valor legal. Os registros apresentados são informativos e refletem dados brutos, não substituindo a ata oficial, que será publicada na pasta de documentos do Google Drive para conferência e eventuais pedidos de retificação. A ata definitiva somente estará consolidada após a aprovação do texto oficial na próxima assembleia.';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => jsPDFWithAutoTable;
  previousAutoTable: {
      finalY: number;
  };
}

// This function will fetch all necessary data
export async function downloadAta(
  firestore: Firestore,
  assembly: Assembly,
  timelineItems: (AtaItem | Poll)[],
  format: 'docx' | 'pdf'
) {
  // 1. Fetch all votes and options for all polls
  const allVotes: Record<string, Vote[]> = {};
  const allOptions: Record<string, PollOption[]> = {};
  const pollIds = timelineItems
    .filter((item) => 'question' in item)
    .map((p) => p.id);

  const userIdsInvolved = new Set<string>();

  for (const pollId of pollIds) {
    const votesQuery = query(
      collection(firestore, `assemblies/${assembly.id}/polls/${pollId}/votes`)
    );
    const optionsQuery = query(
      collection(firestore, `assemblies/${assembly.id}/polls/${pollId}/options`)
    );

    const [votesSnapshot, optionsSnapshot] = await Promise.all([
      getDocs(votesQuery),
      getDocs(optionsQuery),
    ]);

    const votes = votesSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Vote)
    );
    allVotes[pollId] = votes;
    votes.forEach((vote) => {
      userIdsInvolved.add(vote.userId); // The voter
      if (vote.representedUserId) {
        userIdsInvolved.add(vote.representedUserId); // The one being represented
      }
    });

    allOptions[pollId] = optionsSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as PollOption)
    );
  }

  // Also add admins who created AtaItems
   timelineItems.forEach(item => {
    if ('administratorId' in item) {
        userIdsInvolved.add(item.administratorId);
    }
  })

  // 2. Fetch all user profiles for the voters
  const userProfiles: Record<string, UserProfile> = {};
  const userIdArray = Array.from(userIdsInvolved);
  if (userIdArray.length > 0) {
    const userChunks: string[][] = [];
    for (let i = 0; i < userIdArray.length; i += 30) {
      userChunks.push(userIdArray.slice(i, i + 30));
    }
    for (const chunk of userChunks) {
      if (chunk.length === 0) continue;
      const usersQuery = query(
        collection(firestore, 'users'),
        where(documentId(), 'in', chunk)
      );
      const usersSnapshot = await getDocs(usersQuery);
      usersSnapshot.forEach((doc) => {
        userProfiles[doc.id] = { id: doc.id, ...doc.data() } as UserProfile;
      });
    }
  }

  // 3. Generate and download the document based on user role
  if (format === 'docx') {
    await generateDocx(assembly, timelineItems, allVotes, allOptions, userProfiles);
  } else {
    await generatePdf(assembly, timelineItems, allVotes, allOptions, userProfiles);
  }
}

function getPollResult(poll: Poll, options: PollOption[], votes: Vote[]) {
    if (poll.type !== 'proposal' || poll.status === 'open' || poll.status === 'draft') {
        return null;
    }
    if (poll.status === 'annulled') {
        return { status: 'Anulada' as const, message: poll.annulmentReason || 'Votação foi anulada.' };
    }
    
    const activeVotes = votes.filter(v => v.status === 'active');

    const favorOption = options.find(o => o.text.trim().toLowerCase() === 'a favor');
    const contraOption = options.find(o => o.text.trim().toLowerCase() === 'contra');
    const abstencaoOption = options.find(o => o.text.trim().toLowerCase() === 'abstenção');


    if (!favorOption || !contraOption) {
      return { status: 'Indeterminado' as const, message: 'Não é uma votação de proposta padrão (A favor/Contra).' };
    }

    const favorVotes = activeVotes.filter(v => v.pollOptionId === favorOption.id).length;
    const contraVotes = activeVotes.filter(v => v.pollOptionId === contraOption.id).length;
    const abstentionVotes = abstencaoOption ? activeVotes.filter(v => v.pollOptionId === abstencaoOption.id).length : 0;
    
    return calculatePollResult({
        quorumType: poll.quorumType,
        favorVotes,
        contraVotes,
        abstentionVotes,
        totalActiveMembers: poll.totalActiveMembers,
    });
}


async function generatePdf(
  assembly: Assembly,
  timelineItems: (AtaItem | Poll)[],
  allVotes: Record<string, Vote[]>,
  allOptions: Record<string, PollOption[]>,
  userProfiles: Record<string, UserProfile>
) {
  const doc = new jsPDF('p', 'pt', 'a4') as jsPDFWithAutoTable;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const FONT = 'Helvetica';
  doc.setFont(FONT);

  const addText = (text: string, options: { size?: number; style?: 'normal' | 'bold' | 'italic'; spaceAfter?: number; isTitle?: boolean }) => {
    doc.setFontSize(options.size || 10);
    doc.setFont(FONT, options.style || 'normal');
    
    const textDimensions = doc.getTextDimensions(text, { maxWidth: contentWidth });
    const textHeight = textDimensions.h;

    if (y + textHeight > pageHeight - margin && !options.isTitle) {
        doc.addPage();
        y = margin;
    }

    doc.text(text, margin, y, { maxWidth: contentWidth });
    y += textHeight + (options.spaceAfter || 0);
  };
  
  const formatDateTime = (date: Date) => format(date, "dd 'de' MMMM de yyyy, 'às' HH:mm'h'", { locale: ptBR });
  
  // --- Header ---
  addText(assembly.title.toUpperCase(), { size: 14, style: 'bold', spaceAfter: 5, isTitle: true });
  if(assembly.startedAt) {
    addText(`Iniciada em: ${formatDateTime(assembly.startedAt.toDate())}`, { size: 10, spaceAfter: 15 });
  }
  addText('Minuta de Ata', { size: 12, style: 'bold', spaceAfter: 5 });
  addText(DISCLAIMER_TEXT, { size: 8, style: 'italic', spaceAfter: 20 });

  // --- Timeline Items ---
  const sortedTimeline = [...timelineItems].sort((a, b) => {
    const dateA = a.createdAt?.toDate() ?? new Date(0);
    const dateB = b.createdAt?.toDate() ?? new Date(0);
    return dateA.getTime() - dateB.getTime();
  });

  for (const item of sortedTimeline) {
    if (y > margin) {
        if (y + 30 > pageHeight - margin) {
            doc.addPage();
            y = margin;
        } else {
            y += 10;
            doc.setDrawColor(220);
            doc.line(margin, y, pageWidth - margin, y);
            y += 15;
        }
    }

    if ('question' in item) {
        const poll = item as Poll;
        const votes = allVotes[poll.id] || [];
        const options = allOptions[poll.id] || [];
        const optionMap = new Map(options.map((o) => [o.id, o.text]));
        const pollResult = getPollResult(poll, options, votes);
        
        addText(`VOTAÇÃO: ${poll.question}`, { size: 11, style: 'bold', spaceAfter: 5 });
        const typeText = poll.type === 'proposal' ? 'Votação de Proposta' : 'Consulta de Opinião';
        addText(`Tipo: ${typeText}`, { size: 9, spaceAfter: 5 });
        addText(`Período: ${formatDateTime(poll.createdAt.toDate())} a ${formatDateTime(poll.endDate.toDate())}`, { size: 9, spaceAfter: 10 });

        if (pollResult) {
            addText(`Resultado: ${pollResult.status}`, { size: 9, style: 'bold'});
            addText(`Detalhes: ${pollResult.message}`, { size: 9, spaceAfter: 15 });
        }
        
        const activeVotes = votes.filter((vote): vote is typeof vote & { pollOptionId: string } => vote.status === 'active' && typeof vote.pollOptionId === 'string');

        const head = [['NOME', 'EMAIL', 'VOTO', 'POR PROCURAÇÃO A']];
        const body = activeVotes.map((vote) => {
          const personRepresented = userProfiles[vote.representedUserId || ''];
          const voter = userProfiles[vote.userId];
          const optionText = optionMap.get(vote.pollOptionId) || 'Voto inválido';
          return [
            personRepresented?.name || voter?.name || 'Usuário não encontrado',
            personRepresented?.email || voter?.email || 'Email não encontrado',
            optionText,
            vote.representedUserId ? (voter?.name || '') : '',
          ];
        }).sort((a, b) => (a[0] || '').localeCompare(b[0] || ''));

        doc.autoTable({
            head: head,
            body: body,
            startY: y,
            theme: 'striped',
            headStyles: { fillColor: [0, 100, 40], fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 4, font: FONT },
            didDrawPage: (data) => {
              y = data.cursor?.y || margin;
            },
        });

        y = doc.previousAutoTable.finalY + 10;

    } else {
        const ata = item as AtaItem;
        addText(ata.text, { size: 10, spaceAfter: 10 });
    }
  }

  // --- Footer ---
  if (y + 80 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
  y += 10;
  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;

  if (assembly.endedAt) {
    addText(`Encerramento: ${formatDateTime(assembly.endedAt.toDate())}`, { size: 10, spaceAfter: 30 });
  }

  addText(DISCLAIMER_TEXT, { size: 8, style: 'italic', spaceAfter: 15 });

  if (assembly.status === 'live') {
    const partialNotice = `AVISO: A assembleia ainda não foi encerrada. Os registros aqui presentes são parciais e refletem o estado da assembleia no momento da emissão deste documento (${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}).`;
    addText(partialNotice, { size: 8, style: 'bold' });
  }

  doc.save(`Ata - ${assembly.title}.pdf`);
}


async function generateDocx(
  assembly: Assembly,
  timelineItems: (AtaItem | Poll)[],
  allVotes: Record<string, Vote[]>,
  allOptions: Record<string, PollOption[]>,
  userProfiles: Record<string, UserProfile>
) {
  const FONT = 'Arial';
  const formatDateTime = (date: Date) => format(date, "dd 'de' MMMM de yyyy, 'às' HH:mm'h'", { locale: ptBR });
  
  const children: (Paragraph | Table)[] = [];

  // --- Header ---
  children.push(
    new Paragraph({
      children: [new TextRun({ text: assembly.title.toUpperCase(), bold: true, font: FONT, size: 28 })],
      alignment: AlignmentType.LEFT,
    })
  );

  if (assembly.startedAt) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Iniciada em: ${formatDateTime(assembly.startedAt.toDate())}`, font: FONT, size: 20 })],
        alignment: AlignmentType.LEFT,
      })
    );
  }
  children.push(new Paragraph({}));
  
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Minuta de Ata', bold: true, font: FONT, size: 24 })],
      alignment: AlignmentType.LEFT,
    })
  );
  children.push(new Paragraph({
      children: [new TextRun({ text: DISCLAIMER_TEXT, font: FONT, size: 16, italics: true })],
      alignment: AlignmentType.LEFT,
  }));
  children.push(new Paragraph({}));


  // --- Timeline Items (chronological order) ---
  const sortedTimeline = [...timelineItems].sort((a, b) => {
    const dateA = a.createdAt?.toDate() ?? new Date(0);
    const dateB = b.createdAt?.toDate() ?? new Date(0);
    return dateA.getTime() - dateB.getTime();
  });

  for (const item of sortedTimeline) {
    children.push(new Paragraph({ text: '', style: 'line-spacing' }));

    if ('question' in item) {
      const poll = item as Poll;
      const votes = allVotes[poll.id] || [];
      const options = allOptions[poll.id] || [];
      const optionMap = new Map(options.map((o) => [o.id, o.text]));
      const pollResult = getPollResult(poll, options, votes);

      children.push(
        new Paragraph({
          children: [new TextRun({ text: `VOTAÇÃO: ${poll.question}`, bold: true, font: FONT, size: 22 })],
          alignment: AlignmentType.LEFT,
        })
      );
      
      const typeText = poll.type === 'proposal' ? 'Votação de Proposta' : 'Consulta de Opinião';
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Tipo: `, bold: true, font: FONT, size: 18 }),
            new TextRun({ text: typeText, font: FONT, size: 18 }),
          ],
          alignment: AlignmentType.LEFT,
        })
      );
      
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Período: ', font: FONT, size: 18, bold: true }),
            new TextRun({ text: `${formatDateTime(poll.createdAt.toDate())} a ${formatDateTime(poll.endDate.toDate())}`, font: FONT, size: 18 }),
          ],
          alignment: AlignmentType.LEFT,
        })
      );

      if (pollResult) {
          children.push(
              new Paragraph({
                  children: [
                      new TextRun({ text: `Resultado: `, bold: true, font: FONT, size: 18 }),
                      new TextRun({ text: pollResult.status, font: FONT, size: 18 }),
                  ],
                  alignment: AlignmentType.LEFT,
              })
          );
          children.push(
              new Paragraph({
                  children: [
                      new TextRun({ text: `Detalhes: `, bold: true, font: FONT, size: 18 }),
                      new TextRun({ text: pollResult.message, font: FONT, size: 18 }),
                  ],
                  alignment: AlignmentType.LEFT,
              })
          );
      }
      children.push(new Paragraph({}));

      // Votes Table
      const activeVotes = votes.filter(
        (vote): vote is typeof vote & { pollOptionId: string } =>
            vote.status === 'active' && typeof vote.pollOptionId === 'string'
      );
      const voterList = activeVotes
        .map((voter) => {
          const personRepresented = userProfiles[voter.representedUserId || ''];
          const proxyVoter = userProfiles[voter.userId];
          const optionText = optionMap.get(voter.pollOptionId) || 'Voto inválido';
          return {
            name: personRepresented?.name || proxyVoter?.name || 'Usuário não encontrado',
            email: personRepresented?.email || proxyVoter?.email || 'Email não encontrado',
            vote: optionText,
            proxy: voter.representedUserId ? proxyVoter?.name : undefined,
          };
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      const tableRows = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'NOME', bold: true, font: FONT })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'EMAIL', bold: true, font: FONT })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'VOTO', bold: true, font: FONT })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'POR PROCURAÇÃO A', bold: true, font: FONT })] })] }),
          ],
        }),
        ...voterList.map(
          (voter) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: voter.name, font: FONT })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: voter.email, font: FONT })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: voter.vote, font: FONT })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: voter.proxy || '', font: FONT })] })] }),
              ],
            })
        ),
      ];

      const table = new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      });
      children.push(table);
    } else {
      // It's an AtaItem
      const ata = item as AtaItem;
      children.push(
        new Paragraph({
          children: [new TextRun({ text: ata.text, font: FONT, size: 20 })],
          alignment: AlignmentType.LEFT,
        })
      );
    }
  }

  // --- Footer ---
  children.push(new Paragraph({}));
  if (assembly.endedAt) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Encerramento: ${formatDateTime(assembly.endedAt.toDate())}`, font: FONT, size: 20 }),
        ],
        alignment: AlignmentType.LEFT,
      })
    );
  }
  children.push(new Paragraph({}));
  children.push(new Paragraph({
      children: [new TextRun({ text: DISCLAIMER_TEXT, font: FONT, size: 16, italics: true })],
      alignment: AlignmentType.LEFT,
  }));
  
  if (assembly.status === 'live') {
    children.push(new Paragraph({})); // Spacer
    const partialNotice = `AVISO: A assembleia ainda não foi encerrada. Os registros aqui presentes são parciais e refletem o estado da assembleia no momento da emissão deste documento (${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}).`;
    children.push(new Paragraph({
        children: [new TextRun({ text: partialNotice, font: FONT, size: 16, bold: true, italics: true })],
        alignment: AlignmentType.LEFT,
    }));
  }

  const doc = new Document({
    styles: {
        paragraphStyles: [
            {
                id: "line-spacing",
                name: "Line Spacing",
                basedOn: "Normal",
                next: "Normal",
                run: {
                    font: FONT,
                },
                paragraph: {
                    spacing: {
                        before: 100,
                        after: 100
                    },
                },
            },
        ],
    },
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, `Ata - ${assembly.title}.docx`);
  });
}
