# Hidden-test video script

**Target length:** about 1 minute 25 seconds  
**Visuals:** show the grouped results table, then the bar chart.

**[0:00-0:15 | Results table]**  
We tested ten hidden lists with the app's three current methods. For this test, a result is relevant if it matches at least two of the user's ingredients and is missing no more than three non-basic ingredients.

**[0:15-0:45 | Bar chart]**  
Each method gets 50 top-five slots. Coverage's Precision at five is highest: five relevant picks, or 10 percent. Jaccard has two, or 4 percent; TF-IDF has none. So, by our rule, nine out of ten coverage recommendations are weak pantry fits. This is not recipe accuracy or a probability; ranking scores are similarity signals, not confidence.

**[0:45-1:10 | Point to list groups]**  
All methods had zero relevant picks for unsupported cuisines. Coverage did best on weird inputs, with four of twenty. The old rule accepted eight picks with fewer than two pantry matches, so we added the two-match minimum. The cuisine result also points to gaps in our recipe catalog.

**[1:10-1:25 | Pending note]**  
Evaluation now uses the app's `recommend()` function and splits results by list type. This pass is provisional: random and weighted coverage aren't implemented, and Seth's independent marks are still needed to measure agreement.
