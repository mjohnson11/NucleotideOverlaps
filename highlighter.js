document.addEventListener('DOMContentLoaded', () => {
  const textInput = document.getElementById('textInput');
  const highlightDisplay = document.getElementById('highlightDisplay');
  const colorButton = document.getElementById('colorButton');
  const legendDiv = document.getElementById('legend');

  let originalText = '';
  let temporaryMatches = []; // { start, end, isRevComp, sequence }
  let permanentHighlights = []; // { canonicalSeq, className, locations: [{ start, end, isRevComp }] }
  let permanentColorIndex = 0;
  const permanentColorClasses = [
      'perm-highlight-0', 'perm-highlight-1', 'perm-highlight-2', 'perm-highlight-3',
      'perm-highlight-4', 'perm-highlight-5', 'perm-highlight-6', 'perm-highlight-7'
      // Add more classes here if needed
  ];

  // --- Helper Functions ---

  function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, "&")
                .replace(/</g, "<")
                .replace(/>/g, ">")
                //.replace(/"/g, """)
                .replace(/'/g, "'");
  }

  function reverseComplement(dna) {
      const complementMap = {
          'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C', 'N': 'N',
          'a': 't', 't': 'a', 'c': 'g', 'g': 'c', 'n': 'n'
      };
      let complement = '';
      const dnaStr = String(dna || '').toUpperCase(); // Work with uppercase for matching
      for (let i = 0; i < dnaStr.length; i++) {
          complement += complementMap[dnaStr[i]] || dnaStr[i];
      }
      return complement.split('').reverse().join('');
  }

  // --- Core Logic ---

  function findMatches(text, sequenceToFind) {
      const matches = [];
      if (!text || !sequenceToFind || sequenceToFind.length === 0) {
          return matches;
      }

      const seqUpper = sequenceToFind.toUpperCase();
      const revCompUpper = reverseComplement(seqUpper);
      const textUpper = text.toUpperCase(); // Search case-insensitively

      // Use Regex for potentially faster searching
      const regexExact = new RegExp(escapeRegExp(seqUpper), 'g');
      const regexRevComp = (seqUpper !== revCompUpper) ? new RegExp(escapeRegExp(revCompUpper), 'g') : null;

      let match;

      // Find exact matches
      while ((match = regexExact.exec(textUpper)) !== null) {
           matches.push({
               start: match.index,
               end: match.index + seqUpper.length - 1,
               isRevComp: false, // It's a match of the original selection
               sequence: seqUpper // Store the sequence that matched
           });
      }

      // Find reverse complement matches (if different)
      if (regexRevComp) {
          while ((match = regexRevComp.exec(textUpper)) !== null) {
               matches.push({
                   start: match.index,
                   end: match.index + revCompUpper.length - 1,
                   isRevComp: true, // It's a match of the reverse complement
                   sequence: revCompUpper // Store the sequence that matched
               });
          }
      }

      return matches;
  }

   // Helper to escape regex special characters in the sequence
  function escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }


  function renderHighlights() {
      if (!originalText) {
          highlightDisplay.innerHTML = '';
          return;
      }

      // 1. Create coverage array (higher index = higher priority)
      // [ { type: 'perm'/'temp', className: '...', isRevComp: bool } | null ]
      const coverage = Array(originalText.length).fill(null);

      // 2. Apply permanent highlights (lower index = lower priority)
      permanentHighlights.forEach((group, groupIndex) => {
          group.locations.forEach(loc => {
              for (let i = loc.start; i <= loc.end && i < originalText.length; i++) {
                  // Permanent highlights overwrite null or lower-indexed permanent highlights
                  coverage[i] = {
                      type: 'perm',
                      className: group.className,
                      isRevComp: loc.isRevComp, // Track revcomp status relative to group's canonical
                      priority: groupIndex // Lower index = lower priority
                  };
              }
          });
      });

      // 3. Apply temporary highlights (highest priority)
      temporaryMatches.forEach(loc => {
          // Determine isRevComp relative to the *initially selected* sequence
          // (temporaryMatches stores this directly based on how it was found)
          const isTemporaryRevComp = loc.isRevComp;

           for (let i = loc.start; i <= loc.end && i < originalText.length; i++) {
              coverage[i] = {
                  type: 'temp',
                  className: 'temp-highlight',
                  isRevComp: isTemporaryRevComp, // Is the temp match a revcomp of the selection?
                  priority: Infinity // Highest priority
              };
          }
      });


      // 4. Build HTML string
      let html = '';
      let currentSpan = null; // { className: '...', isRevComp: bool }

      for (let i = 0; i < originalText.length; i++) {
          const cov = coverage[i]; // Coverage object for this index, or null
          const desiredSpan = cov ? { className: cov.className, isRevComp: cov.isRevComp } : null;

          // Check if span state needs to change
          if ( (currentSpan === null && desiredSpan !== null) ||
               (currentSpan !== null && desiredSpan === null) ||
               (currentSpan !== null && desiredSpan !== null &&
                (currentSpan.className !== desiredSpan.className || currentSpan.isRevComp !== desiredSpan.isRevComp)) )
          {
              if (currentSpan !== null) {
                  html += '</span>'; // Close previous span
              }
              if (desiredSpan !== null) {
                  const borderClass = desiredSpan.isRevComp ? ' revcomp-match' : '';
                  html += `<span class="${desiredSpan.className}${borderClass}">`; // Start new span
              }
              currentSpan = desiredSpan;
          }

          html += escapeHtml(originalText[i]);
      }

      // Close the last span if necessary
      if (currentSpan !== null) {
          html += '</span>';
      }

      highlightDisplay.innerHTML = html;

      // Update button state
      colorButton.disabled = temporaryMatches.length === 0;
  }

  function updateLegend() {
      legendDiv.innerHTML = ''; // Clear existing legend

      permanentHighlights.forEach(group => {
          const legendItem = document.createElement('div');
          legendItem.className = 'legend-item';

          const colorBox = document.createElement('div');
          colorBox.className = `legend-color ${group.className}`;

          const textBox = document.createElement('div');
          textBox.className = 'legend-text';
          textBox.textContent = group.canonicalSeq; // Display the canonical sequence

          legendItem.appendChild(colorBox);
          legendItem.appendChild(textBox);
          legendDiv.appendChild(legendItem);
      });

       // Add static legend entry for the border if any permanent highlights exist
      if (permanentHighlights.length > 0 || temporaryMatches.some(m => m.isRevComp)) {
           const revCompLegendItem = document.createElement('div');
           revCompLegendItem.className = 'legend-item';
           revCompLegendItem.innerHTML = `<div class="legend-color revcomp-match" style="background-color: transparent;"></div> <div class="legend-text">Reverse complement match</div>`;
           legendDiv.appendChild(revCompLegendItem);
       }
  }


  // --- Event Handlers ---

  textInput.addEventListener('input', () => {
      originalText = textInput.value;
      // Clear everything when text is manually changed
      temporaryMatches = [];
      permanentHighlights = [];
      permanentColorIndex = 0;
      highlightDisplay.innerHTML = escapeHtml(originalText); // Show plain text
      updateLegend();
      colorButton.disabled = true;

      // Synchronize scroll positions (optional but nice)
       highlightDisplay.scrollTop = textInput.scrollTop;
       highlightDisplay.scrollLeft = textInput.scrollLeft;
  });

   // Sync scrolling from textarea to display
   textInput.addEventListener('scroll', () => {
      highlightDisplay.scrollTop = textInput.scrollTop;
      highlightDisplay.scrollLeft = textInput.scrollLeft;
   });


  const handleSelection = () => {
      const selectionStart = textInput.selectionStart;
      const selectionEnd = textInput.selectionEnd;
      const selectedText = textInput.value.substring(selectionStart, selectionEnd);

      temporaryMatches = []; // Clear previous temporary matches

      if (selectedText && selectedText.length >= 4) {
          temporaryMatches = findMatches(originalText, selectedText);
          // Use the actual selected text (first match's sequence) as the base for isRevComp check later
          // This assumes findMatches returns the matched sequence correctly
          if(temporaryMatches.length > 0) {
               const firstMatchSeq = temporaryMatches[0].sequence;
               const firstMatchIsRevComp = temporaryMatches[0].isRevComp;
               // Re-evaluate isRevComp for all matches based on the *first* match found
               // This establishes a consistent "canonical" for the temp group
               const canonicalForTemp = firstMatchIsRevComp ? reverseComplement(firstMatchSeq) : firstMatchSeq;
               temporaryMatches.forEach(m => {
                  m.isRevComp = (m.sequence !== canonicalForTemp);
               });
          }

      }

      renderHighlights(); // This will also update button state
  };

  textInput.addEventListener('mouseup', handleSelection);
  textInput.addEventListener('keyup', handleSelection); // Handle keyboard selections


  colorButton.addEventListener('click', () => {
      if (temporaryMatches.length > 0) {
          const canonicalSeq = temporaryMatches.find(m => !m.isRevComp)?.sequence || temporaryMatches[0].sequence; // Prefer non-revcomp as canonical
          const className = permanentColorClasses[permanentColorIndex % permanentColorClasses.length];

          // Add to permanent highlights, converting temporary match structure
          permanentHighlights.push({
              canonicalSeq: canonicalSeq,
              className: className,
              locations: temporaryMatches.map(m => ({
                  start: m.start,
                  end: m.end,
                  // isRevComp MUST be relative to the canonicalSeq we just determined
                  isRevComp: (m.sequence !== canonicalSeq)
              }))
          });

          permanentColorIndex++;
          temporaryMatches = []; // Clear temporary matches
          renderHighlights(); // Update display (removes temp, shows new perm), disables button
          updateLegend();
      }
  });

  // Initial state
  originalText = textInput.value;
  highlightDisplay.innerHTML = escapeHtml(originalText);
  updateLegend();
});