/**
 * Calculates the reverse complement of a nucleotide sequence.
 * Handles 'A', 'T', 'C', 'G', 'N' (case-insensitive) and preserves case.
 * @param {string} dna The nucleotide sequence.
 * @returns {string} The reverse complement sequence.
 */
function reverseComplement(dna) {
  const complementMap = {
      'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C', 'N': 'N',
      'a': 't', 't': 'a', 'c': 'g', 'g': 'c', 'n': 'n'
  };
  let complement = '';
  for (let i = 0; i < dna.length; i++) {
      complement += complementMap[dna[i]] || dna[i];
  }
  return complement.split('').reverse().join('');
}

// Function definition (ensure this replaces the previous version)
/**
 * Finds repeated substrings (length >= minLength) within nucleotide sequences
 * found in a long string, considering both the sequences and their reverse complements.
 *
 * @param {string} longString The input string potentially containing nucleotide sequences.
 * @param {number} [minLength=8] The minimum length of substrings to consider.
 * @returns {Map<string, Array<object>>} A Map where keys are the repeated uppercase substrings,
 *          and values are arrays of location objects. Each location object indicates
 *          where the substring was found:
 *          {
 *              start: number, // Absolute start index of the substring in the original longString
 *              end: number,   // Absolute *inclusive* end index of the substring in the original longString
 *              type: 'original' | 'revcomp' // How this specific match was found relative to the regex hit
 *          }
 */
function findRepeatedNucleotideSubstrings(longString, minLength = 8) {
  if (!longString || typeof longString !== 'string') {
      return new Map();
  }
  if (minLength < 1) {
      throw new Error("minLength must be at least 1");
  }

  const nucleotideRegex = /[ATCGN]+/gi;
  const substringOccurrences = new Map();

  let match;
  while ((match = nucleotideRegex.exec(longString)) !== null) {
      const originalSequence = match[0];
      const originalSeqStartIndex = match.index;
      const originalSeqLength = originalSequence.length;

      if (originalSeqLength < minLength) {
          continue;
      }

      // Prepare both original and reverse complement uppercase versions
      const originalUpper = originalSequence.toUpperCase();
      const revCompUpper = reverseComplement(originalSequence).toUpperCase();

      const sequencesToSearch = [
          { sequence: originalUpper, type: 'original' },
          { sequence: revCompUpper, type: 'revcomp' }
      ];

      for (const { sequence, type } of sequencesToSearch) {
          const seqLen = sequence.length;
          for (let i = 0; i <= seqLen - minLength; i++) {
              for (let j = i + minLength - 1; j < seqLen; j++) {
                  const substring = sequence.substring(i, j + 1); // This is the actual matched substring (uppercase)

                  let absoluteStart, absoluteEnd;

                  if (type === 'original') {
                      absoluteStart = originalSeqStartIndex + i;
                      absoluteEnd = originalSeqStartIndex + j;
                  } else { // type === 'revcomp'
                      // Map revcomp indices back to original sequence indices
                      const originalEndIndex = originalSeqLength - 1 - i;
                      const originalStartIndex = originalSeqLength - 1 - j;
                      absoluteStart = originalSeqStartIndex + originalStartIndex;
                      absoluteEnd = originalSeqStartIndex + originalEndIndex;
                  }

                  const location = {
                      start: absoluteStart,
                      end: absoluteEnd,
                      // *** Store the type of match relative to the parent segment ***
                      // This is NOT necessarily whether the substring itself is a revcomp of the canonical legend entry yet
                      type: type
                  };

                  // Store occurrences based on the substring sequence found
                  if (substringOccurrences.has(substring)) {
                      substringOccurrences.get(substring).push(location);
                  } else {
                      substringOccurrences.set(substring, [location]);
                  }
              }
          }
      }
  }

  // Filter for repeats (more than one occurrence)
  const repeatedSubstrings = new Map();
  for (const [substring, locations] of substringOccurrences.entries()) {
      if (locations.length > 1) {
          repeatedSubstrings.set(substring, locations);
      }
  }

  return repeatedSubstrings;
}

// --- reduceRepeatsToMaximal function remains the same ---
/**
* Reduces a map of repeated substrings to only include maximal repeats.
* Prioritizes longer repeats.
* @param {Map<string, Array<object>>} repeatsMap - The output from findRepeatedNucleotideSubstrings.
* @param {number} [minLength=8] - The minimum length used in the initial search.
* @returns {Map<string, Array<object>>} A new Map containing only the maximal repeated substrings.
*/
function reduceRepeatsToMaximal(repeatsMap, minLength = 8) {
   if (!repeatsMap || repeatsMap.size === 0) {
      return new Map();
  }
  const sortedSubstrings = Array.from(repeatsMap.keys()).sort((a, b) => b.length - a.length);
  const maximalRepeats = new Map();
  const subsumedSubstrings = new Set();

  for (const currentSub of sortedSubstrings) {
      if (subsumedSubstrings.has(currentSub)) {
          continue;
      }
      maximalRepeats.set(currentSub, repeatsMap.get(currentSub));
      const currentLen = currentSub.length;
      if (currentLen > minLength) {
           for (let i = 0; i <= currentLen - minLength; i++) {
               // Corrected inner loop: length is j - i
               for (let j = i + minLength; j <= currentLen; j++) { // j is the length here
                   if (i === 0 && j === currentLen) continue;
                   const shorterSub = currentSub.substring(i, j); // substring end index is exclusive
                    if (repeatsMap.has(shorterSub)) {
                       subsumedSubstrings.add(shorterSub);
                   }
               }
           }
      }
  }
  return maximalRepeats;
}

/**
 * Reduces a map of repeated substrings to only include maximal repeats.
 * If "ABCDEFG" is a repeat, and "BCDEF" is also found as a repeat using
 * locations contained within the "ABCDEFG" locations, "BCDEF" will be removed.
 * Prioritizes longer repeats.
 *
 * @param {Map<string, Array<object>>} repeatsMap - The output from findRepeatedNucleotideSubstrings.
 * @param {number} [minLength=8] - The minimum length used in the initial search (needed for generating substrings).
 * @returns {Map<string, Array<object>>} A new Map containing only the maximal repeated substrings.
 */
function reduceRepeatsToMaximal(repeatsMap, minLength = 8) {
  if (!repeatsMap || repeatsMap.size === 0) {
      return new Map();
  }

  // Get all repeated substrings and sort them by length, descending
  const sortedSubstrings = Array.from(repeatsMap.keys()).sort((a, b) => b.length - a.length);

  const maximalRepeats = new Map();
  const subsumedSubstrings = new Set(); // Keep track of substrings covered by longer ones

  for (const currentSub of sortedSubstrings) {
      // If this substring has already been marked as part of a longer repeat, skip it
      if (subsumedSubstrings.has(currentSub)) {
          continue;
      }

      // This is potentially a maximal repeat (among those processed so far)
      // Add it to our results
      maximalRepeats.set(currentSub, repeatsMap.get(currentSub));

      // Now, mark all shorter substrings *contained within* this one
      // that were also found in the original repeatsMap as subsumed.
      const currentLen = currentSub.length;
      if (currentLen > minLength) { // Only substrings longer than minLength can subsume others
           // Iterate through all possible start positions for shorter subs
           for (let i = 0; i <= currentLen - minLength; i++) {
               // Iterate through all possible end positions (length >= minLength)
               // Ensure we don't just re-add the currentSub itself
               for (let j = i + minLength; j <= currentLen; j++) {
                   if (i === 0 && j === currentLen) continue; // Skip the exact same substring

                   const shorterSub = currentSub.substring(i, j);

                   // Check if this shorter substring was actually in the original results
                   if (repeatsMap.has(shorterSub)) {
                       subsumedSubstrings.add(shorterSub);
                   }
               }
           }
      }
  }

  // --- Refinement: Handle the "matches the most substring locations" aspect ---
  // The above prioritizes length absolutely. If the goal is truly "longest that matches the *most* locations",
  // the logic gets more complex. The current approach finds the longest first and removes its sub-parts.
  // Let's stick to this length-prioritized approach as it's the most common interpretation of "maximal repeat".
  // If frequency tie-breaking is strictly needed, the approach would need significant changes, potentially
  // involving grouping locations first.

  return maximalRepeats;
}

// --- Helper function (assuming it's defined elsewhere or included) ---
function reverseComplement(dna) {
  const complementMap = {
      'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C', 'N': 'N',
      'a': 't', 't': 'a', 'c': 'g', 'g': 'c', 'n': 'n'
  };
  let complement = '';
  for (let i = 0; i < dna.length; i++) {
      complement += complementMap[dna[i]] || dna[i];
  }
  return complement.split('').reverse().join('');
}

/**
 * Escapes HTML special characters in a string.
 * @param {string} str The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&")
            .replace(/</g, "<")
            .replace(/>/g, ">")
            //.replace(/"/g, """)
            .replace(/'/g, "'");
}


// Function definition (ensure this replaces the previous version)
/**
 * Generates highlighted HTML and a legend based on maximal repeats.
 * Consolidates legend for sequences and their reverse complements.
 * Adds a border to highlighted segments that are reverse complements
 * of the sequence shown in the legend.
 * Handles overlapping regions by prioritizing the repeat that appears
 * first in the maximalRepeats map (longest first).
 *
 * @param {string} longString The original input string.
 * @param {Map<string, Array<object>>} maximalRepeats The map of maximal repeats and their absolute locations.
 * @returns {{highlightedHtml: string, legendHtml: string}} Object containing the HTML strings.
 */
function highlightRepeats(longString, maximalRepeats) {
  if (!longString) {
      return { highlightedHtml: '', legendHtml: '' };
  }
  if (maximalRepeats.size === 0) {
      return { highlightedHtml: escapeHtml(longString), legendHtml: '<p>No repeats found.</p>' };
  }

  const colorClasses = [
      'repeat-highlight-0', 'repeat-highlight-1', 'repeat-highlight-2',
      'repeat-highlight-3', 'repeat-highlight-4', 'repeat-highlight-5',
      'repeat-highlight-6', 'repeat-highlight-7', 'repeat-highlight-8',
      'repeat-highlight-9'
  ];
  const canonicalRepeatMap = new Map(); // Map<string, {className: string, canonicalSeq: string}> canonical sequence -> details
  const legendEntries = [];
  let colorIndex = 0;

  // 1. Assign colors/classes, determine canonical form, and flatten ranges
  const allRanges = [];

  // Iterate through the maximal repeats (already sorted by length desc by reduceRepeatsToMaximal)
  for (const [repeatSeq, locations] of maximalRepeats.entries()) {
      const revCompSeq = reverseComplement(repeatSeq);
      let details = canonicalRepeatMap.get(repeatSeq) || canonicalRepeatMap.get(revCompSeq);
      let canonicalSeqForThisGroup;

      if (!details) {
          // Neither this sequence nor its reverse complement has been assigned a color yet
          // Assign a new color and choose this sequence as canonical
          const className = colorClasses[colorIndex % colorClasses.length];
          canonicalSeqForThisGroup = repeatSeq; // Use the first encountered as canonical
          details = { className, canonicalSeq: canonicalSeqForThisGroup };

          // Store mapping for both the sequence and its reverse complement
          canonicalRepeatMap.set(repeatSeq, details);
          canonicalRepeatMap.set(revCompSeq, details); // Map rev comp to the same details

          legendEntries.push({ className, canonicalSeq: canonicalSeqForThisGroup });
          colorIndex++;
      } else {
          // Already have details, use the existing canonical sequence
           canonicalSeqForThisGroup = details.canonicalSeq;
      }

      const currentClassName = details.className;

      // Add ranges for highlighting
      locations.forEach(loc => {
          // Determine if THIS specific occurrence (repeatSeq) is the reverse complement
          // of the sequence chosen for the legend (canonicalSeqForThisGroup)
          const isRevCompOfCanonical = (repeatSeq === reverseComplement(canonicalSeqForThisGroup)) || (loc.type=='revcomp');

           if (loc.start <= loc.end) {
               allRanges.push({
                   start: loc.start,
                   end: loc.end,
                   className: currentClassName,
                   isRevComp: isRevCompOfCanonical // Mark if it needs a border
               });
           } else {
              console.warn("Skipping range with start > end:", loc, "for sequence:", repeatSeq);
           }
      });
  }

  // 2. Sort ranges: primary by start index (asc), secondary by end index (desc - longer first)
  allRanges.sort((a, b) => {
      if (a.start !== b.start) {
          return a.start - b.start;
      }
      return b.end - a.end; // Longer ranges first if they start at the same place
  });

  // 3. Build coverage map (determine which range covers each index, handling overlaps)
  // Store the *entire* winning range object to access className and isRevComp
  const coverage = Array(longString.length).fill(null);
  for (const range of allRanges) {
      for (let i = range.start; i <= range.end; i++) {
          // Only apply if the index isn't already covered by a higher-priority range
          if (i < longString.length && coverage[i] === null) {
              coverage[i] = range; // Store the winning range object
          }
      }
  }

  // 4. Generate highlighted HTML string
  let highlightedHtml = '';
  let currentRange = null; // Store the currently active range object
  for (let i = 0; i < longString.length; i++) {
      const char = longString[i];
      const desiredRange = coverage[i]; // The range object covering this index, or null

      if (desiredRange !== currentRange) {
          if (currentRange !== null) {
              highlightedHtml += '</span>'; // Close previous span
          }
          if (desiredRange !== null) {
              // Start new span, adding the revcomp class if needed
              const borderClass = desiredRange.isRevComp ? ' revcomp-match' : '';
              highlightedHtml += `<span class="${desiredRange.className}${borderClass}">`;
          }
          currentRange = desiredRange;
      }
      highlightedHtml += escapeHtml(char);
  }
  if (currentRange !== null) {
      highlightedHtml += '</span>'; // Close the last span
  }

  // 5. Generate Legend HTML (using only canonical sequences)
  let legendHtml = '';
  if (legendEntries.length > 0) {
      legendEntries.sort((a, b) => a.className.localeCompare(b.className)); // Sort by class name
      legendEntries.forEach(entry => {
          legendHtml += `
              <div class="legend-item">
                  <div class="legend-color ${entry.className}"></div>
                  <div class="legend-text">${escapeHtml(entry.canonicalSeq)}</div>
              </div>
          `;
      });
  } else {
      legendHtml = '<p>No repeats found to highlight.</p>';
  }

  return { highlightedHtml, legendHtml };
}

// --- Helper functions (escapeHtml, reverseComplement) should also be present ---
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&")
            .replace(/</g, "<")
            .replace(/>/g, ">")
            //.replace(/"/g, """)
            .replace(/'/g, "'");
}
// Make sure reverseComplement is defined correctly
function reverseComplement(dna) {
  const complementMap = {
      'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C', 'N': 'N',
      'a': 't', 't': 'a', 'c': 'g', 'g': 'c', 'n': 'n'
  };
  let complement = '';
   // Ensure input is treated as string, handle potential null/undefined
  const dnaStr = String(dna || '');
  for (let i = 0; i < dnaStr.length; i++) {
      complement += complementMap[dnaStr[i]] || dnaStr[i]; // Keep non-standard chars
  }
  return complement.split('').reverse().join('');
}

// --- reduceRepeatsToMaximal remains the same ---
function reduceRepeatsToMaximal(repeatsMap, minLength = 8) {
   if (!repeatsMap || repeatsMap.size === 0) {
      return new Map();
  }
  const sortedSubstrings = Array.from(repeatsMap.keys()).sort((a, b) => b.length - a.length);
  const maximalRepeats = new Map();
  const subsumedSubstrings = new Set();

  for (const currentSub of sortedSubstrings) {
      if (subsumedSubstrings.has(currentSub)) {
          continue;
      }
      // Pass the original locations object along
      maximalRepeats.set(currentSub, repeatsMap.get(currentSub));
      const currentLen = currentSub.length;
      if (currentLen > minLength) {
           for (let i = 0; i <= currentLen - minLength; i++) {
               for (let j = i + minLength; j <= currentLen; j++) {
                   if (i === 0 && j === currentLen) continue;
                   const shorterSub = currentSub.substring(i, j);
                    if (repeatsMap.has(shorterSub)) {
                       subsumedSubstrings.add(shorterSub);
                   }
               }
           }
      }
  }
  return maximalRepeats;
}


// --- Main Execution Logic (DOM Ready) ---
// (Paste the existing document.addEventListener('DOMContentLoaded', ...) block here)
document.addEventListener('DOMContentLoaded', () => {
  const inputArea = document.getElementById('inputSequence');
  const minLengthInput = document.getElementById('minLength');
  const analyzeButton = document.getElementById('analyzeButton');
  const outputDiv = document.getElementById('highlightedOutput');
  const legendDiv = document.getElementById('legend');

  analyzeButton.addEventListener('click', () => {
      const longString = inputArea.value;
      const minLength = parseInt(minLengthInput.value, 10) || 8;

      if (!longString) {
          outputDiv.textContent = 'Please enter sequence data.';
          legendDiv.innerHTML = '';
          return;
      }

      try {
          outputDiv.textContent = 'Analyzing...';
          legendDiv.innerHTML = '';

          // Run the analysis pipeline
          const allRepeats = findRepeatedNucleotideSubstrings(longString, minLength);
          const maximalRepeats = reduceRepeatsToMaximal(allRepeats, minLength);

          // Generate and display highlights
          // Ensure maximalRepeats map is passed correctly
          console.log(maximalRepeats);
          const { highlightedHtml, legendHtml } = highlightRepeats(longString, maximalRepeats);

          outputDiv.innerHTML = highlightedHtml;
          legendDiv.innerHTML = legendHtml;

      } catch (error) {
          console.error("Analysis Error:", error);
          outputDiv.textContent = `Error during analysis: ${error.message}`;
          legendDiv.innerHTML = '';
      }
  });

  // Example: Trigger analysis on initial load if desired
  // analyzeButton.click();
});


// --- Main Execution ---
document.addEventListener('DOMContentLoaded', () => {
  const inputArea = document.getElementById('inputSequence');
  const minLengthInput = document.getElementById('minLength');
  const analyzeButton = document.getElementById('analyzeButton');
  const outputDiv = document.getElementById('highlightedOutput');
  const legendDiv = document.getElementById('legend');

  analyzeButton.addEventListener('click', () => {
      const longString = inputArea.value;
      const minLength = parseInt(minLengthInput.value, 10) || 8;

      if (!longString) {
          outputDiv.textContent = 'Please enter sequence data.';
          legendDiv.innerHTML = '';
          return;
      }

      try {
          outputDiv.textContent = 'Analyzing...';
          legendDiv.innerHTML = '';

          // Run the analysis pipeline
          const allRepeats = findRepeatedNucleotideSubstrings(longString, minLength);
          const maximalRepeats = reduceRepeatsToMaximal(allRepeats, minLength);

          // Generate and display highlights
          const { highlightedHtml, legendHtml } = highlightRepeats(longString, maximalRepeats);

          outputDiv.innerHTML = highlightedHtml;
          legendDiv.innerHTML = legendHtml;

      } catch (error) {
          console.error("Analysis Error:", error);
          outputDiv.textContent = `Error during analysis: ${error.message}`;
          legendDiv.innerHTML = '';
      }
  });

  // Optional: Trigger analysis on initial load
  // analyzeButton.click();
});

// --- Make sure all functions are defined before this point ---
// (reverseComplement, findRepeatedNucleotideSubstrings, reduceRepeatsToMaximal, escapeHtml, highlightRepeats)