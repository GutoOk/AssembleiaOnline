'use client';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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

// This function will fetch all necessary data
export async function downloadAta(
  firestore: Firestore,
  assembly: Assembly,
  timelineItems: (AtaItem | Poll)[],
  isAdmin: boolean
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
  if (isAdmin) {
    await generateDocx(assembly, timelineItems, allVotes, allOptions, userProfiles);
  } else {
    await generatePdf(assembly, timelineItems, allVotes, allOptions, userProfiles);
  }
}

// This function generates the HTML content for the PDF
function generateAtaHtml(
    assembly: Assembly,
    timelineItems: (AtaItem | Poll)[],
    allVotes: Record<string, Vote[]>,
    allOptions: Record<string, PollOption[]>,
    userProfiles: Record<string, UserProfile>
): string {
    const formatTime = (date: Date) => format(date, "HH:mm'h'", { locale: ptBR });
    const formatDateTime = (date: Date) =>
        format(date, "dd 'de' MMMM de yyyy, 'às' HH:mm'h'", { locale: ptBR });
    
    const sortedTimeline = [...timelineItems].sort((a, b) => {
        const dateA = a.createdAt?.toDate() ?? new Date(0);
        const dateB = b.createdAt?.toDate() ?? new Date(0);
        return dateA.getTime() - dateB.getTime();
    });

    let html = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: auto; padding: 20px;">
            <h1 style="text-align: center; font-size: 24px; margin-bottom: 8px;">ATA DA ASSEMBLEIA GERAL</h1>
            <h2 style="text-align: center; font-size: 20px; margin-top: 0; margin-bottom: 24px; font-weight: bold;">${assembly.title.toUpperCase()}</h2>
            
            <p><strong>Data Agendada:</strong> ${formatDateTime(assembly.date.toDate())}</p>
    `;

    if (assembly.location) {
        const locationString = `${assembly.location.address}, ${assembly.location.city} - ${assembly.location.state}`;
        html += `<p><strong>Local:</strong> ${locationString}</p>`;
    }
    if (assembly.startedAt) {
        html += `<p><strong>Início Real:</strong> ${formatDateTime(assembly.startedAt.toDate())}</p>`;
    }

    html += `
        <br />
        <h3 style="text-align: center; font-size: 18px; margin-top: 24px; margin-bottom: 24px; font-weight: bold;">DELIBERAÇÕES</h3>
    `;

    sortedTimeline.forEach(item => {
        html += '<div style="margin-top: 24px;">';

        if ('question' in item) {
            const poll = item as Poll;
            const votes = allVotes[poll.id] || [];
            const options = allOptions[poll.id] || [];
            const optionMap = new Map(options.map((o) => [o.id, o.text]));
            
            html += `
                <h4 style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">VOTAÇÃO: ${poll.question}</h4>
                <p style="font-size: 14px; margin-top: 0;">
                    <strong>Iniciada em:</strong> ${formatTime(poll.createdAt.toDate())} / 
                    <strong>Encerrada em:</strong> ${formatTime(poll.endDate.toDate())}
                </p>
            `;
            
            const voterList = votes.map((vote) => {
              const personRepresented = userProfiles[vote.representedUserId || ''];
              const voter = userProfiles[vote.userId];
              const optionText = optionMap.get(vote.pollOptionId) || 'Voto inválido';
              return {
                name: personRepresented?.name || voter?.name || 'Usuário não encontrado',
                email: personRepresented?.email || voter?.email || 'Email não encontrado',
                vote: optionText,
                proxy: vote.representedUserId ? voter?.name : '',
              };
            }).sort((a, b) => a.email.localeCompare(b.email));

            html += `
                <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px;">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">NOME</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">EMAIL</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">VOTO</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">POR PROCURAÇÃO A</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            voterList.forEach(voter => {
                html += `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px;">${voter.name}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${voter.email}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${voter.vote}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${voter.proxy || ''}</td>
                    </tr>
                `;
            });
            html += '</tbody></table>';

        } else {
            const ata = item as AtaItem;
            html += `<p style="font-size: 14px;"><strong>[${formatTime(ata.createdAt.toDate())}]</strong> ${ata.text}</p>`;
        }
        html += '</div>';
    });

    html += '<br />';
    if (assembly.endedAt) {
        html += `<p><strong>Encerramento:</strong> ${formatDateTime(assembly.endedAt.toDate())}</p>`;
    }
    html += '<br />';
    html += '<p style="text-align: center; margin-top: 24px;">A presente ata foi lavrada e segue para registro.</p>';
    html += '</div>';

    return html;
}

// This function generates the PDF
async function generatePdf(
    assembly: Assembly,
    timelineItems: (AtaItem | Poll)[],
    allVotes: Record<string, Vote[]>,
    allOptions: Record<string, PollOption[]>,
    userProfiles: Record<string, UserProfile>
) {
    const htmlContent = generateAtaHtml(assembly, timelineItems, allVotes, allOptions, userProfiles);
    
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    // Append to body to ensure styles are applied and elements are rendered
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
        scale: 2, // Higher scale for better quality
    });
    
    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = imgWidth / imgHeight;
    const canvasPdfWidth = pdfWidth - 20; // with margin
    const canvasPdfHeight = canvasPdfWidth / ratio;
    
    let heightLeft = canvasPdfHeight;
    let position = 10;
    
    pdf.addImage(imgData, 'PNG', 10, position, canvasPdfWidth, canvasPdfHeight);
    heightLeft -= (pdfHeight - 20);

    while (heightLeft > 0) {
        position = heightLeft - canvasPdfHeight + 10; // move to next page
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, canvasPdfWidth, canvasPdfHeight);
        heightLeft -= (pdfHeight - 20);
    }
    
    pdf.save(`Ata - ${assembly.title}.pdf`);
}


// This function generates the docx
async function generateDocx(
  assembly: Assembly,
  timelineItems: (AtaItem | Poll)[],
  allVotes: Record<string, Vote[]>,
  allOptions: Record<string, PollOption[]>,
  userProfiles: Record<string, UserProfile>
) {
  const formatTime = (date: Date) => format(date, "HH:mm'h'", { locale: ptBR });
  const formatDateTime = (date: Date) =>
    format(date, "dd 'de' MMMM de yyyy, 'às' HH:mm'h'", { locale: ptBR });

  const children: any[] = [];

  // Header
  children.push(
    new Paragraph({
      text: 'ATA DA ASSEMBLEIA GERAL',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    })
  );
  children.push(
    new Paragraph({
      text: assembly.title.toUpperCase(),
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    })
  );
  children.push(new Paragraph({})); // Spacer

  // Basic Info
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Data Agendada: ', bold: true }),
        new TextRun(formatDateTime(assembly.date.toDate())),
      ],
    })
  );

  if (assembly.location) {
    const locationString = `${assembly.location.address}, ${assembly.location.city} - ${assembly.location.state}`;
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Local: ', bold: true }),
          new TextRun(locationString),
        ],
      })
    );
  }

  if (assembly.startedAt) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Início Real: ', bold: true }),
          new TextRun(formatDateTime(assembly.startedAt.toDate())),
        ],
      })
    );
  }
  children.push(new Paragraph({})); // Spacer
  children.push(
    new Paragraph({
      text: 'DELIBERAÇÕES',
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
    })
  );

  // Timeline Items (chronological order)
  const sortedTimeline = [...timelineItems].sort((a, b) => {
    const dateA = a.createdAt?.toDate() ?? new Date(0);
    const dateB = b.createdAt?.toDate() ?? new Date(0);
    return dateA.getTime() - dateB.getTime();
  });

  for (const item of sortedTimeline) {
    children.push(new Paragraph({})); // Spacer

    if ('question' in item) {
      // It's a Poll
      const poll = item as Poll;
      const votes = allVotes[poll.id] || [];
      const options = allOptions[poll.id] || [];
      const optionMap = new Map(options.map((o) => [o.id, o.text]));

      children.push(
        new Paragraph({
          text: `VOTAÇÃO: ${poll.question}`,
          heading: HeadingLevel.HEADING_3,
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Iniciada em: ', bold: true }),
            new TextRun(formatTime(poll.createdAt.toDate())),
            new TextRun(' / '),
            new TextRun({ text: 'Encerrada em: ', bold: true }),
            new TextRun(formatTime(poll.endDate.toDate())),
          ],
        })
      );

      // Votes Table
      const voterList = votes
        .map((vote) => {
          const personRepresented = userProfiles[vote.representedUserId || ''];
          const voter = userProfiles[vote.userId];
          const optionText = optionMap.get(vote.pollOptionId) || 'Voto inválido';
          return {
            name: personRepresented?.name || voter?.name || 'Usuário não encontrado',
            email: personRepresented?.email || voter?.email || 'Email não encontrado',
            vote: optionText,
            proxy: vote.representedUserId ? voter?.name : undefined,
          };
        })
        .sort((a, b) => a.email.localeCompare(b.email));

      const tableRows = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              children: [new Paragraph({ text: 'NOME', bold: true })],
            }),
            new TableCell({
              children: [new Paragraph({ text: 'EMAIL', bold: true })],
            }),
            new TableCell({
              children: [new Paragraph({ text: 'VOTO', bold: true })],
            }),
            new TableCell({
              children: [
                new Paragraph({ text: 'POR PROCURAÇÃO A', bold: true }),
              ],
            }),
          ],
        }),
        ...voterList.map(
          (voter) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(voter.name)] }),
                new TableCell({ children: [new Paragraph(voter.email)] }),
                new TableCell({ children: [new Paragraph(voter.vote)] }),
                new TableCell({ children: [new Paragraph(voter.proxy || '')] }),
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
          children: [
            new TextRun({
              text: `[${formatTime(ata.createdAt.toDate())}] `,
              bold: true,
            }),
            new TextRun(ata.text),
          ],
        })
      );
    }
  }

  // Footer
  children.push(new Paragraph({}));
  if (assembly.endedAt) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Encerramento: ', bold: true }),
          new TextRun(formatDateTime(assembly.endedAt.toDate())),
        ],
      })
    );
  }
  children.push(new Paragraph({}));
  children.push(
    new Paragraph({
      text: 'A presente ata foi lavrada e segue para registro.',
      alignment: AlignmentType.CENTER,
    })
  );

  // Generate document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, `Ata - ${assembly.title}.docx`);
  });
}
