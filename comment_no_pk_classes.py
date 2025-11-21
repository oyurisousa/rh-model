"""
Script para comentar classes SQLAlchemy sem chave primária
"""
import re

# Lê o arquivo
with open('generated_models.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Divide o conteúdo em linhas
lines = content.split('\n')

# Identifica classes e suas PKs
classes = {}
current_class = None
current_class_start = 0
has_pk = False

for i, line in enumerate(lines):
    # Detecta início de classe
    class_match = re.match(r'^class ([A-Z][a-zA-Z0-9_]*)\(Base\):', line)
    if class_match:
        # Salva estado da classe anterior
        if current_class:
            classes[current_class] = {
                'start': current_class_start,
                'has_pk': has_pk
            }
        
        # Nova classe
        current_class = class_match.group(1)
        current_class_start = i
        has_pk = False
    
    # Detecta primary_key=True
    if current_class and 'primary_key=True' in line:
        has_pk = True
    
    # Detecta fim da classe (linha vazia após relationships ou última linha)
    if current_class and i > current_class_start + 2:
        # Se encontrar nova classe ou 2 linhas vazias consecutivas
        if (line.strip() == '' and i + 1 < len(lines) and 
            (lines[i+1].strip() == '' or lines[i+1].startswith('class '))):
            classes[current_class] = {
                'start': current_class_start,
                'has_pk': has_pk
            }
            if not line.startswith('class'):
                current_class = None

# Salva a última classe
if current_class:
    classes[current_class] = {
        'start': current_class_start,
        'has_pk': has_pk
    }

# Identifica classes sem PK
no_pk_classes = [name for name, info in classes.items() if not info['has_pk']]

print(f"Total de classes: {len(classes)}")
print(f"Classes SEM chave primária: {len(no_pk_classes)}\n")

if no_pk_classes:
    print("Classes sem PK:")
    for cls in sorted(no_pk_classes):
        print(f"  - {cls}")
    
    # Cria arquivo comentado
    output_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Verifica se é início de uma classe sem PK
        class_match = re.match(r'^class ([A-Z][a-zA-Z0-9_]*)\(Base\):', line)
        if class_match and class_match.group(1) in no_pk_classes:
            class_name = class_match.group(1)
            
            # Adiciona comentário antes da classe
            output_lines.append(f"# ATENÇÃO: Classe {class_name} não possui chave primária definida no banco")
            output_lines.append(f"# O SQLAlchemy requer pelo menos uma coluna como primary_key")
            output_lines.append(f"# Verifique o schema do banco ou descomente e defina uma PK manualmente")
            output_lines.append(f"'''")
            
            # Comenta a classe toda até a próxima classe ou fim
            while i < len(lines):
                output_lines.append(lines[i])
                i += 1
                
                # Para quando encontrar próxima classe ou duas linhas vazias
                if i < len(lines) - 1:
                    if lines[i].strip() == '' and (
                        i + 1 >= len(lines) or 
                        lines[i + 1].startswith('class ') or
                        (lines[i + 1].strip() == '' and i + 2 < len(lines) and lines[i + 2].startswith('class'))
                    ):
                        output_lines.append("'''")
                        output_lines.append("")
                        break
        else:
            output_lines.append(line)
            i += 1
    
    # Salva arquivo modificado
    with open('generated_models_commented.py', 'w', encoding='utf-8') as f:
        f.write('\n'.join(output_lines))
    
    print(f"\n✅ Arquivo salvo: generated_models_commented.py")
    print(f"📊 {len(no_pk_classes)} classes foram comentadas")
else:
    print("✅ Todas as classes possuem chave primária!")
