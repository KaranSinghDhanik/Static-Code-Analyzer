%{
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#define MAX_SYMBOLS 100
#define PENALTY_ERROR 15      
#define PENALTY_WARNING 5     

struct Symbol {
    char name[20];
    char type[10];
    int declared_line;
    int first_use_line;      
    int first_assign_line;    
    int use_count;
    int is_used;             
} symtab[MAX_SYMBOLS];

int line = 1;
int count = 0;
int declaration_mode = 0;
char current_type[10] = "";

/* Pending identifier: could be LHS of assignment or a use */
char pending_name[20] = "";
int pending_index = -1;     
int pending_is_undeclared = 0;

/* Assignment tracking */
int in_assignment = 0;        
int assign_lhs_index = -1;
char assign_rhs_type[10] = "";

/* Issue counters for ATS score */
int error_count = 0;
int warning_count = 0;

/* Check if variable exists, return index or -1 */
int find_index(char name[]) {
    for (int i = 0; i < count; i++) {
        if (strcmp(symtab[i].name, name) == 0)
            return i;
    }
    return -1;
}

/* Add variable to symbol table */
void add(char name[]) {
    strcpy(symtab[count].name, name);
    strcpy(symtab[count].type, current_type);
    symtab[count].declared_line = line;
    symtab[count].first_use_line = 0;
    symtab[count].first_assign_line = 0;
    symtab[count].use_count = 0;
    symtab[count].is_used = 0;
    count++;
}

/* Record variable use (in expression) */
void record_use(int idx) {
    if (idx < 0) return;
    symtab[idx].use_count++;
    if (symtab[idx].first_use_line == 0)
        symtab[idx].first_use_line = line;
    symtab[idx].is_used = 1;
}

/* Record variable assignment */
void record_assign(int idx) {
    if (idx < 0) return;
    if (symtab[idx].first_assign_line == 0)
        symtab[idx].first_assign_line = line;
    symtab[idx].is_used = 1;
}

/* Check type compatibility: assign type 'from' to variable of type 'to' */
int type_compatible(const char *to, const char *from) {
    if (strcmp(to, from) == 0) return 1;
    /* int can receive int literal; float can receive int or float */
    if (strcmp(to, "float") == 0 && strcmp(from, "int") == 0) return 1;
    return 0;
}

/* End of statement - clear assignment state */
void end_statement() {
    declaration_mode = 0;
    current_type[0] = '\0';
    in_assignment = 0;
    assign_lhs_index = -1;
    assign_rhs_type[0] = '\0';
    pending_name[0] = '\0';
    pending_index = -1;
    pending_is_undeclared = 0;
}

/* Resolve pending identifier as USE (in expression) */
void resolve_pending_as_use() {
    if (pending_name[0] == '\0') return;
    if (pending_is_undeclared) {
        /* Already reported undeclared */
        pending_name[0] = '\0';
        pending_index = -1;
        pending_is_undeclared = 0;
        return;
    }
    if (pending_index >= 0) {
        record_use(pending_index);
    }
    pending_name[0] = '\0';
    pending_index = -1;
    pending_is_undeclared = 0;
}

/* Compute and print ATS (Acceptability Test Score) */
void print_ats_report() {
    int i;
    int unused_count = 0;
    int use_before_init_count = 0;

    printf("\n========== SEMANTIC ANALYSIS REPORT ==========\n\n");

    /* Check unused variables */
    for (i = 0; i < count; i++) {
        if (symtab[i].use_count == 0 && symtab[i].first_assign_line == 0) {
            printf("Warning (line %d): Unused variable '%s'\n",
                   symtab[i].declared_line, symtab[i].name);
            unused_count++;
            warning_count++;
        }
    }

    /* Check use before initialization */
    for (i = 0; i < count; i++) {
        if (symtab[i].first_use_line > 0 && symtab[i].first_assign_line > 0) {
            if (symtab[i].first_use_line < symtab[i].first_assign_line) {
                printf("Error: Variable '%s' used at line %d before initialization at line %d\n",
                       symtab[i].name, symtab[i].first_use_line, symtab[i].first_assign_line);
                use_before_init_count++;
                error_count++;
            }
        } else if (symtab[i].first_use_line > 0 && symtab[i].first_assign_line == 0) {
            printf("Error: Variable '%s' used at line %d but never initialized\n",
                   symtab[i].name, symtab[i].first_use_line);
            use_before_init_count++;
            error_count++;
        }
    }

    /* ATS Score Calculation */
    printf("\n---------- ATS (ACCEPTABILITY TEST SCORE) ----------\n");
    printf("Measures code quality and efficiency based on static analysis.\n\n");

    int ats_score = 100;
    int error_penalty = error_count * PENALTY_ERROR;
    int warning_penalty = warning_count * PENALTY_WARNING;
    ats_score -= error_penalty;
    ats_score -= warning_penalty;
    if (ats_score < 0) ats_score = 0;

    printf("  Errors found:     %d (-%d pts each = -%d)\n", error_count, PENALTY_ERROR, error_penalty);
    printf("  Warnings found:   %d (-%d pts each = -%d)\n", warning_count, PENALTY_WARNING, warning_penalty);
    printf("  ----------------------------------------\n");
    printf("  ATS Score:        %d / 100\n\n", ats_score);

    if (ats_score >= 90)
        printf("  Rating: EXCELLENT - Code is well-structured and efficient.\n");
    else if (ats_score >= 75)
        printf("  Rating: GOOD - Minor issues; code is generally good.\n");
    else if (ats_score >= 60)
        printf("  Rating: FAIR - Several issues need attention.\n");
    else if (ats_score >= 40)
        printf("  Rating: POOR - Significant correctness/quality issues.\n");
    else
        printf("  Rating: CRITICAL - Code has major issues; fix before use.\n");

    printf("\n====================================================\n");
}
%}

%option noyywrap

%%

"int" {
    resolve_pending_as_use();
    strcpy(current_type, "int");
    declaration_mode = 1;
    printf("KEYWORD: int\n");
}

"float" {
    resolve_pending_as_use();
    strcpy(current_type, "float");
    declaration_mode = 1;
    printf("KEYWORD: float\n");
}

[0-9]+\.[0-9]+ {
    resolve_pending_as_use();
    if (in_assignment && assign_lhs_index >= 0) {
        strcpy(assign_rhs_type, "float");
        if (!type_compatible(symtab[assign_lhs_index].type, "float")) {
            printf("Error (line %d): Type mismatch - cannot assign float to int variable '%s'\n",
                   line, symtab[assign_lhs_index].name);
            error_count++;
        }
    }
    printf("NUMBER: %s (float)\n", yytext);
}

[0-9]+ {
    resolve_pending_as_use();
    if (in_assignment && assign_lhs_index >= 0) {
        strcpy(assign_rhs_type, "int");
        /* int literal to int/float is OK */
    }
    printf("NUMBER: %s (int)\n", yytext);
}

[a-zA-Z_][a-zA-Z0-9_]* {
    if (declaration_mode) {
        int idx = find_index(yytext);
        if (idx >= 0) {
            printf("Error (line %d): Redeclaration of '%s'\n", line, yytext);
            error_count++;
        } else {
            add(yytext);
            printf("Declared: %s (%s)\n", yytext, current_type);
        }
    } else {
        int idx = find_index(yytext);
        if (idx < 0) {
            printf("Error (line %d): Undeclared variable '%s'\n", line, yytext);
            error_count++;
            strcpy(pending_name, yytext);
            pending_index = -1;
            pending_is_undeclared = 1;
        } else {
            /* If we're in "id = " and see another id, it's RHS - check type */
            if (in_assignment && assign_lhs_index >= 0) {
                if (!type_compatible(symtab[assign_lhs_index].type, symtab[idx].type)) {
                    printf("Error (line %d): Type mismatch - cannot assign %s to %s variable '%s'\n",
                           line, symtab[idx].type, symtab[assign_lhs_index].type,
                           symtab[assign_lhs_index].name);
                    error_count++;
                }
                record_use(idx);
                /* Don't set as pending - RHS id was consumed */
                printf("IDENTIFIER: %s (RHS)\n", yytext);
            } else {
                strcpy(pending_name, yytext);
                pending_index = idx;
                pending_is_undeclared = 0;
                printf("IDENTIFIER: %s\n", yytext);
            }
        }
    }
}

"=" {
    if (pending_name[0] != '\0' && !pending_is_undeclared && pending_index >= 0) {
        assign_lhs_index = pending_index;
        in_assignment = 1;
        record_assign(pending_index);
        pending_name[0] = '\0';
        pending_index = -1;
        pending_is_undeclared = 0;
    } else if (pending_is_undeclared) {
        /* Cannot assign to undeclared - already reported */
        pending_name[0] = '\0';
        pending_index = -1;
        pending_is_undeclared = 0;
    } else {
        resolve_pending_as_use();
    }
    printf("OPERATOR: =\n");
}

[+\-*/] {
    resolve_pending_as_use();
    if (in_assignment) {
        /* RHS is expression - type checking would need full parser; skip for now */
    }
    printf("OPERATOR: %s\n", yytext);
}

\n    { line++; }

";" {
    if (in_assignment && assign_lhs_index >= 0) {
        /* Check type if we had id = id */
        assign_rhs_type[0] = '\0';
    }
    end_statement();
    printf("DELIMITER: ;\n");
}

[ \t]+     ;   /* ignore spaces and tabs */

.            {
    resolve_pending_as_use();
    printf("DELIMITER/UNKNOWN: %s\n", yytext);
}

%%

int main(int argc, char *argv[]) {
    char *filename = "input.txt";
    if (argc >= 2) filename = argv[1];

    FILE *fp = fopen(filename, "r");
    if (fp == NULL) {
        printf("Error: %s not found\n", filename);
        return 1;
    }

    yyin = fp;

    printf("========== STATIC CODE ANALYZER ==========\n");
    printf("Lexical + Semantic Analysis with ATS Score\n\n");

    yylex();

    /* Type check: when we had "id = id", we need assign_rhs_type - handled in identifier rule for RHS */
    /* For "a = b" we set pending when we see b, then = doesn't apply. So b gets resolved as use. */
    /* When we see "a = b", a is pending, then = makes a the LHS. Then b is identifier - that's RHS.
       So we need: when we see identifier and in_assignment, it's RHS. Set assign_rhs_type from that id's type.
       Then we can check type compatibility. Let me add that. */  

    fclose(fp);

    print_ats_report();

    return 0;
}
